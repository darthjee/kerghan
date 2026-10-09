<?php

/**
 * Router script for the stub upstream started by StubUpstreamServer
 * (`php -S 127.0.0.1:<port> session_cookies_router.php`).
 *
 * Mimics the NestJS backend's session-cookie responses (see
 * backend/src/auth/auth-cookies.ts): login sets access_token, refresh_token
 * (httpOnly, Path=/auth) and logged_in; logoff clears all three. Each cookie
 * is its own `Set-Cookie` line, exactly as Express emits them, and every
 * response carries `X-Skip-Cache` like the backend's non-GET routes do.
 */

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

$expired = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT';

$routes = [
    'POST /auth/login.json' => [
        'status' => 201,
        'cookies' => [
            'access_token=stub-access-jwt; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Strict',
            'refresh_token=stub-refresh-token; Max-Age=2592000; Path=/auth; HttpOnly; Secure; SameSite=Strict',
            'logged_in=1; Max-Age=2592000; Path=/; Secure; SameSite=Strict',
        ],
    ],
    'DELETE /auth/logoff.json' => [
        'status' => 200,
        'cookies' => [
            "access_token=; Path=/; $expired; HttpOnly; Secure; SameSite=Strict",
            "refresh_token=; Path=/auth; $expired; HttpOnly; Secure; SameSite=Strict",
            "logged_in=; Path=/; $expired; Secure; SameSite=Strict",
        ],
    ],
];

$route = $routes["$method $path"] ?? null;

if ($route === null) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo '{"error":"not found"}';
    return;
}

http_response_code($route['status']);
header('Content-Type: application/json');
header('X-Skip-Cache: 1');

foreach ($route['cookies'] as $cookie) {
    // replace = false: keep every Set-Cookie line, as Express does.
    header('Set-Cookie: ' . $cookie, false);
}

echo '{}';
