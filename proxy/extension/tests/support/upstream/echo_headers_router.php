<?php

/**
 * Router script for the stub upstream started by StubUpstreamServer
 * (`php -S 127.0.0.1:<port> echo_headers_router.php`).
 *
 * Echoes the request headers the upstream received, as JSON, so proxy tests
 * can assert on what Tent actually forwards:
 *
 * - `headers`: the headers by the name they arrived with (`getallheaders()`).
 * - `forwardedFor`: `$_SERVER['HTTP_X_FORWARDED_FOR']`, where PHP's built-in
 *   server joins repeated `X-Forwarded-For` lines (whatever their casing)
 *   with `, `, so an extra line can't hide behind another one.
 */

header('Content-Type: application/json');
header('X-Skip-Cache: 1');

echo json_encode([
    'headers' => getallheaders(),
    'forwardedFor' => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
]);
