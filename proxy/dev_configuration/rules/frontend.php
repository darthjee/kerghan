<?php

/**
 * Frontend routing rules.
 * In development mode, proxies requests to the Vite dev server.
 * In production mode, serves static files directly.
 */

use Tent\Configuration;

if (getenv('FRONTEND_DEV_MODE') === 'true') {
    // Development mode: forward to the Vite server (HMR)
    // Content-Security-Policy for the documents serving index.html: the
    // production policy, loosened only where Vite needs it (inline
    // React-refresh preamble, injected <style> tags, HMR websocket).
    $contentSecurityPolicy = implode('; ', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' ws: wss:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ]);

    // OAuth App / GitHub App callback landings: serve Vite's index.html (path
    // rewritten to `/`), never cached, kept out of Referer headers and served
    // with the CSP. `exact` compares the path only, so any query string matches
    // but no other path does.
    Configuration::buildRule([
        'handler' => [
            'type' => 'proxy',
            'host' => 'http://frontend:8080'
        ],
        'matchers' => [
            ['method' => 'GET', 'uri' => '/integrations/oauth_app/callback', 'type' => 'exact'],
            ['method' => 'GET', 'uri' => '/integrations/github_app/callback', 'type' => 'exact'],
        ],
        'middlewares' => [
            [
                'class' => 'Tent\Middlewares\SetPathMiddleware',
                'path' => '/'
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
            'type' => 'proxy',
            'host' => 'http://frontend:8080'
        ],
        'matchers' => [
            ['method' => 'GET', 'uri' => '/', 'type' => 'exact'],
        ],
        'middlewares' => [
            [
                'class' => 'Tent\Middlewares\SetResponseHeadersMiddleware',
                'headers' => [
                    'Content-Security-Policy' => $contentSecurityPolicy
                ]
            ]
        ]
    ]);
    Configuration::buildRule([
        'handler' => [
            'type' => 'proxy',
            'host' => 'http://frontend:8080'
        ],
        'matchers' => [
            ['method' => 'GET', 'uri' => '/assets/js/', 'type' => 'begins_with'],
            ['method' => 'GET', 'uri' => '/assets/css/', 'type' => 'begins_with'],
            ['method' => 'GET', 'uri' => '/assets/images/', 'type' => 'begins_with'],
            ['method' => 'GET', 'uri' => '/@vite/', 'type' => 'begins_with'],
            ['method' => 'GET', 'uri' => '/node_modules/', 'type' => 'begins_with'],
            ['method' => 'GET', 'uri' => '/@react-refresh', 'type' => 'exact'],
        ]
    ]);
} else {
    // Production mode: serve static files from docker_volumes/static/
    // Content-Security-Policy for the documents serving index.html: the exact
    // production policy (see proxy/prod_configuration/rules/frontend.php), so
    // running the built bundle locally exercises it.
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

    // OAuth App / GitHub App callback landings: serve index.html, never cached,
    // kept out of Referer headers and served with the CSP. `exact` compares the
    // path only, so any query string matches but no other path does.
    Configuration::buildRule([
        'handler' => [
            'type' => 'static',
            'location' => '/var/www/html/static'
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
            'location' => '/var/www/html/static'
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
            'location' => '/var/www/html/static'
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
}
