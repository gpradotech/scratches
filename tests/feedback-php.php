<?php
declare(strict_types=1);

require dirname(__DIR__) . '/servicos/feedback/php/receiver.php';

use function Scratches\Feedback\handle;
use function Scratches\Feedback\validate;

$directory = sys_get_temp_dir() . '/scratches-feedback-test-' . bin2hex(random_bytes(8));
mkdir($directory, 0700);
$config = ['api_key' => 'test-only-key', 'from' => 'service@example.test', 'to' => 'recipient@example.test', 'state_dir' => $directory];
$payload = ['id' => 'fc53d3db-a84a-4329-b6ad-d5ac0455155d', 'kind' => 'suggestion', 'message' => 'Uma sugestão para o catálogo.', 'email' => ''];
$raw = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
$passed = 0;
$check = function (bool $condition, string $name) use (&$passed): void {
    if (!$condition) {
        throw new RuntimeException($name);
    }
    $passed++;
};
$accepted = static fn(array $mail, string $key, string $id): array => ['status' => 200, 'body' => ['id' => 'test-provider-id']];

try {
    $check(handle('GET', '/api/feedback', '', '', [], 'client')['body'] === ['available' => false], 'Missing configuration reports unavailable');
    $check(handle('POST', '/api/feedback', 'application/json', $raw, [], 'client')['status'] === 503, 'Unconfigured service cannot send');
    $check(handle('GET', '/other', '', '', $config, 'client')['status'] === 404, 'Unknown route');
    $check(handle('DELETE', '/api/feedback', '', '', $config, 'client')['status'] === 405, 'Unsupported method');
    $check(handle('POST', '/api/feedback', 'text/plain', $raw, $config, 'client')['status'] === 415, 'Non-JSON request rejected');

    $received = [];
    $transport = function (array $mail, string $key, string $id) use (&$received, $accepted): array {
        $received[] = compact('mail', 'key', 'id');
        return $accepted($mail, $key, $id);
    };
    $withReply = json_encode([...$payload, 'email' => 'reply@example.test'], JSON_THROW_ON_ERROR);
    $first = handle('POST', '/api/feedback', 'application/json', $withReply, $config, 'sender', $transport, 1000);
    $second = handle('POST', '/api/feedback', 'application/json', $withReply, $config, 'sender', $transport, 1000);
    $check($first === ['status' => 202, 'body' => ['accepted' => true]], 'Only explicit provider acceptance succeeds');
    $check($received[0]['mail']['to'] === [$config['to']] && $received[0]['mail']['from'] === $config['from'], 'Destination is server-controlled');
    $check($received[0]['mail']['reply_to'] === 'reply@example.test', 'Optional reply address');
    $check($received[0]['id'] === $received[1]['id'] && $second['status'] === 202, 'Retry forwards the same idempotency identity');
    $check(!str_contains(json_encode($first), $config['to']) && !str_contains(json_encode($first), $config['api_key']), 'Success response is private');

    foreach ([['to' => 'override@example.test'], ['api_key' => 'override'], ['from' => 'override@example.test'], ['id' => 'invalid'], ['kind' => []], ['message' => 'short'], ['email' => "bad\n@example.test"]] as $index => $change) {
        $before = count($received);
        $result = handle('POST', '/api/feedback', 'application/json', json_encode([...$payload, ...$change], JSON_THROW_ON_ERROR), $config, 'invalid-' . $index, $transport, 1000);
        $check($result['status'] === 400 && count($received) === $before, 'Invalid input cannot contact provider: ' . $index);
    }
    foreach (['[]', '{', str_repeat('x', 24001)] as $index => $invalid) {
        $check(handle('POST', '/api/feedback', 'application/json', $invalid, $config, 'raw-' . $index, $transport, 1000)['status'] === 400, 'Malformed input: ' . $index);
    }
    $check(validate(json_encode([...$payload, 'message' => str_repeat('😀', 2000)], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE))['message'] === str_repeat('😀', 2000), 'Emoji length follows browser UTF-16 limit');
    $check(handle('POST', '/api/feedback', 'application/json', json_encode([...$payload, 'message' => str_repeat('😀', 2001)], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $config, 'emoji', $transport, 1000)['status'] === 400, 'Oversized emoji input rejected');

    $providerError = static fn(): array => ['status' => 403, 'body' => ['message' => 'test-only-key recipient@example.test']];
    $failure = handle('POST', '/api/feedback', 'application/json', $raw, $config, 'failure', $providerError, 1000);
    $check($failure['status'] === 502 && !str_contains(json_encode($failure), 'test-only-key') && !str_contains(json_encode($failure), $config['to']), 'Provider errors are redacted');
    $missingId = static fn(): array => ['status' => 200, 'body' => []];
    $check(handle('POST', '/api/feedback', 'application/json', $raw, $config, 'missing-id', $missingId, 1000)['status'] === 502, 'Provider success requires an identifier');
    $throws = static function (): array { throw new RuntimeException('test-only-key recipient@example.test'); };
    $check(handle('POST', '/api/feedback', 'application/json', $raw, $config, 'exception', $throws, 1000)['status'] === 502, 'Transport failures are sanitized');

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $check(handle('POST', '/api/feedback', 'application/json', $raw, $config, 'rate-client', $accepted, 1000)['status'] === 202, 'Allowed attempt: ' . $attempt);
    }
    $check(handle('POST', '/api/feedback', 'application/json', $raw, $config, 'rate-client', $accepted, 1000)['status'] === 429, 'Sixth attempt is blocked across requests');
    $check(handle('POST', '/api/feedback', 'application/json', $raw, $config, 'rate-client', $accepted, 1600)['status'] === 202, 'Expired window recovers');
    $stored = file_get_contents($directory . '/rate-limits.json');
    $check(!str_contains($stored, $payload['message']) && !str_contains($stored, 'rate-client'), 'Rate state contains no messages or raw client address');
    file_put_contents($directory . '/rate-limits.json', '{broken');
    $check(handle('POST', '/api/feedback', 'application/json', $raw, $config, 'corrupt', $accepted, 1000)['status'] === 503, 'Corrupt private state fails closed');
    echo json_encode(['phpReceiverAssertionsPassed' => $passed, 'realEmailsSent' => 0]) . PHP_EOL;
} finally {
    foreach (glob($directory . '/*') as $file) {
        unlink($file);
    }
    rmdir($directory);
}
