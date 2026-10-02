<?php

use Tent\Configuration;

// OAuth App callback landing: GitHub redirects the browser here with
// `?code=...&state=...`. Serve the SPA's index.html directly (never the
// `/path -> /#/path` redirect, never cached) so the query string stays in the
// address bar, and keep it out of Referer headers. Tent's `exact` matcher
// compares the path only (query string excluded), so this matches any query
// but no other path.
Configuration::buildRule([
    'handler' => [
        'type' => 'static',
        'location' => $staticRoot . '/static'
    ],
    'matchers' => [
        ['method' => 'GET', 'uri' => '/integrations/oauth_app/callback', 'type' => 'exact'],
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
                'Referrer-Policy' => 'no-referrer'
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
        ]
    ]
]);
