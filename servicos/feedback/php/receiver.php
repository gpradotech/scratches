<?php
declare(strict_types=1);

namespace Scratches\Feedback;

const KINDS = ['problem' => 'Problema', 'suggestion' => 'Sugestão', 'other' => 'Outro'];

function utf16Length(string $value): int
{
    return intdiv(strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')), 2);
}

function validate(string $raw): array
{
    if (strlen($raw) > 24000) {
        throw new \InvalidArgumentException('A mensagem excede o tamanho permitido.');
    }
    try {
        $value = json_decode($raw, false, 16, JSON_THROW_ON_ERROR);
    } catch (\JsonException $error) {
        throw new \InvalidArgumentException('Confira os campos do formulário.');
    }
    if (!$value instanceof \stdClass || array_diff(array_keys(get_object_vars($value)), ['id', 'kind', 'message', 'email'])) {
        throw new \InvalidArgumentException('Confira os campos do formulário.');
    }
    if (!isset($value->id, $value->kind) || !is_string($value->id) || !is_string($value->kind)
        || !preg_match('/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iD', $value->id)
        || !array_key_exists($value->kind, KINDS)) {
        throw new \InvalidArgumentException('Confira os campos do formulário.');
    }
    $message = isset($value->message) && is_string($value->message)
        ? preg_replace('/^\s+|\s+$/u', '', $value->message) : null;
    if ($message === null || utf16Length($message) < 10 || utf16Length($value->message) > 4000) {
        throw new \InvalidArgumentException('Escreva uma mensagem entre 10 e 4.000 caracteres.');
    }
    if (!isset($value->email) || !is_string($value->email) || utf16Length($value->email) > 254
        || ($value->email !== '' && !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/uD', $value->email))) {
        throw new \InvalidArgumentException('Informe um e-mail válido ou deixe esse campo vazio.');
    }
    return ['id' => $value->id, 'kind' => $value->kind, 'message' => $message, 'email' => trim($value->email)];
}

// A single locked file keeps the limit shared across PHP workers. It contains no feedback text.
function takeAttempt(string $directory, string $client, int $now): bool
{
    $file = @fopen($directory . '/rate-limits.json', 'c+');
    if ($file === false) {
        throw new \RuntimeException('Private storage unavailable');
    }
    try {
        if (!flock($file, LOCK_EX)) {
            throw new \RuntimeException('Private storage unavailable');
        }
        @chmod($directory . '/rate-limits.json', 0600);
        $raw = stream_get_contents($file);
        $entries = $raw === '' ? [] : json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
        if (!is_array($entries)) {
            throw new \RuntimeException('Private storage unavailable');
        }
        foreach ($entries as $key => $entry) {
            if (!is_array($entry) || ($entry['until'] ?? 0) <= $now) {
                unset($entries[$key]);
            }
        }
        $key = hash('sha256', $client);
        $entry = $entries[$key] ?? ['count' => 0, 'until' => $now + 600];
        if ($entry['count'] >= 5 || (count($entries) >= 10000 && !isset($entries[$key]))) {
            return false;
        }
        $entry['count']++;
        $entries[$key] = $entry;
        $json = json_encode($entries, JSON_THROW_ON_ERROR);
        rewind($file);
        if (!ftruncate($file, 0) || fwrite($file, $json) !== strlen($json) || !fflush($file)) {
            throw new \RuntimeException('Private storage unavailable');
        }
        return true;
    } finally {
        flock($file, LOCK_UN);
        fclose($file);
    }
}

function sendResend(array $mail, string $key, string $id): array
{
    $curl = curl_init('https://api.resend.com/emails');
    if ($curl === false) {
        throw new \RuntimeException('Provider unavailable');
    }
    try {
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $key,
                'Content-Type: application/json',
                'Idempotency-Key: feedback/' . $id,
            ],
            CURLOPT_POSTFIELDS => json_encode($mail, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
        ]);
        $raw = curl_exec($curl);
        if ($raw === false) {
            throw new \RuntimeException('Provider unavailable');
        }
        return ['status' => curl_getinfo($curl, CURLINFO_RESPONSE_CODE), 'body' => json_decode($raw, true, 16, JSON_THROW_ON_ERROR)];
    } finally {
        curl_close($curl);
    }
}

function handle(string $method, string $path, string $contentType, string $raw, array $config, string $client, ?callable $transport = null, ?int $now = null): array
{
    $reply = static fn(int $status, array $body): array => ['status' => $status, 'body' => $body];
    if ($path !== '/api/feedback') {
        return $reply(404, ['error' => 'Página não encontrada.']);
    }
    $configured = !empty($config['api_key']) && !empty($config['from']) && !empty($config['to'])
        && !empty($config['state_dir']) && is_dir($config['state_dir']) && is_writable($config['state_dir'])
        && function_exists('mb_convert_encoding') && function_exists('curl_init');
    if ($method === 'GET') {
        return $reply(200, ['available' => $configured]);
    }
    if ($method !== 'POST') {
        return $reply(405, ['error' => 'Método não disponível.']);
    }
    if (!$configured) {
        return $reply(503, ['error' => 'O envio de feedback ainda não está disponível.']);
    }
    if (!str_starts_with(strtolower($contentType), 'application/json')) {
        return $reply(415, ['error' => 'Solicitação inválida.']);
    }
    try {
        if (!takeAttempt($config['state_dir'], $client, $now ?? time())) {
            return $reply(429, ['error' => 'Aguarde alguns minutos antes de tentar novamente.']);
        }
    } catch (\Throwable $error) {
        return $reply(503, ['error' => 'Não foi possível enviar agora. Tente novamente.']);
    }
    try {
        $payload = validate($raw);
    } catch (\InvalidArgumentException $error) {
        return $reply(400, ['error' => $error->getMessage()]);
    }
    $mail = ['from' => $config['from'], 'to' => [$config['to']], 'subject' => '[Scratches] ' . KINDS[$payload['kind']], 'text' => $payload['message']];
    if ($payload['email'] !== '') {
        $mail['reply_to'] = $payload['email'];
    }
    try {
        $response = ($transport ?? __NAMESPACE__ . '\\sendResend')($mail, $config['api_key'], $payload['id']);
        if (($response['status'] ?? 0) >= 200 && $response['status'] < 300
            && is_string($response['body']['id'] ?? null) && $response['body']['id'] !== '') {
            return $reply(202, ['accepted' => true]);
        }
    } catch (\Throwable $error) {
        // Provider errors can contain credentials and addresses. Never return or log them.
    }
    return $reply(502, ['error' => 'Não foi possível enviar agora. Tente novamente.']);
}
