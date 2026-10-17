<?php
declare(strict_types=1);

ini_set('display_errors', '0');
require __DIR__ . '/receiver.php';

$config = [];
// Hostinger keeps the account home outside every domain's public_html directory.
$home = getenv('HOME') ?: (preg_match('#^(/home/[^/]+)/#', __DIR__, $match) ? $match[1] : '');
$configFile = getenv('SCRATCHES_FEEDBACK_CONFIG') ?: ($home ? $home . '/.scratches-feedback/config.php' : '');
$documentRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? __DIR__);
$privateFile = $configFile ? realpath($configFile) : false;
if ($privateFile && $documentRoot && !str_starts_with(str_replace('\\', '/', $privateFile), rtrim(str_replace('\\', '/', $documentRoot), '/') . '/')) {
    try {
        $loaded = require $privateFile;
        if (is_array($loaded)) {
            $config = $loaded;
            $config['state_dir'] = dirname($privateFile);
        }
    } catch (Throwable $error) {
        $config = [];
    }
}

$response = \Scratches\Feedback\handle(
    $_SERVER['REQUEST_METHOD'] ?? 'GET',
    parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/',
    $_SERVER['CONTENT_TYPE'] ?? '',
    (string)file_get_contents('php://input', false, null, 0, 24001),
    $config,
    $_SERVER['REMOTE_ADDR'] ?? 'unknown',
);
http_response_code($response['status']);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo json_encode($response['body'], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
