<?php

use Tent\Configuration;

// Content-Security-Policy for every response that serves the SPA's index.html.
// The built frontend has no inline script/style, no CDN, no eval and no
// third-party origin; Bootstrap's CSS uses `data:` SVGs. Update this alongside
// any dependency that changes that.
$contentSecurityPolicy = implode('; ', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
]);

// OAuth App / GitHub App callback landings: GitHub redirects the browser here
// with `?code=...&state=...` (GitHub App installs may add
// `&installation_id=...&setup_action=...`). Serve the SPA's index.html directly (never the
// `/path -> /#/path` redirect, never cached) so the query string stays in the
// address bar, keep it out of Referer headers, and apply the CSP. Tent's `exact` matcher
// compares the path only (query string excluded), so this matches any query
// but no other path.
Configuration::buildRule([
    'handler' => [
        'type' => 'static',
        'location' => $staticRoot . '/static'
    ],
    'matchers' => [
        ['method' => 'GET', 'uri' => '/integrations/oauth_app/callback', 'type' => 'exact'],
        ['method' => 'GET', 'uri' => '/integrations/github_app/callback', 'type' => 'exact'],
    ],
    'middlewares' => [
        [
            'class' => 'Tent\Middlewares\SetPathMiddleware',
            'path' => '/index.html'
        ],
        [
            'class' => 'Tent\Middlewares\SetResponseHeadersMiddleware',
            'headers' => [
                'Cache-Control' => 'no-store',
                'Referrer-Policy' => 'no-referrer',
                'Content-Security-Policy' => $contentSecurityPolicy
            ]
        ]
    ]
]);

Configuration::buildRule([
    'handler' => [
        'type' => 'static',
        'location' => $staticRoot . '/static'
    ],
    'matchers' => [
        ['method' => 'GET', 'uri' => '/assets', 'type' => 'begins_with'],
    ],
    'middlewares' => [
        [
            'class' => 'Tent\Middlewares\CacheControlMiddleware',
            'maxAgeSeconds' => 60 * 60 * 24
        ]
    ]
]);

Configuration::buildRule([
    'handler' => [
        'type' => 'static',
        'location' => $staticRoot . '/static'
    ],
    'matchers' => [
        ['method' => 'GET', 'uri' => '/', 'type' => 'exact'],
    ],
    'middlewares' => [
        [
            'class' => 'Tent\Middlewares\SetPathMiddleware',
            'path' => '/index.html'
        ],
        [
            'class' => 'Tent\Middlewares\CacheControlMiddleware',
            'maxAgeSeconds' => 60 * 60 * 24
        ],
        [
            'class' => 'Tent\Middlewares\SetResponseHeadersMiddleware',
            'headers' => [
                'Content-Security-Policy' => $contentSecurityPolicy
            ]
        ]
    ]
]);
