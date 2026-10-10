<?php

/**
 * Tent configuration for the standalone (Vault) stack.
 *
 * Mirrors proxy/prod_configuration/ and must be kept in sync with it: same
 * rules, same middlewares, same CSP. Only locals.php differs (committed here,
 * no secrets). No Navi and no /admin in standalone.
 *
 * The custom middlewares used by the rules (SetClientIpMiddleware,
 * CacheControlMiddleware, SetResponseHeadersMiddleware) come from
 * proxy/extension/, copied into the image at build time (see
 * dockerfiles/kerghan_standalone/Dockerfile).
 */

require_once __DIR__ . '/locals.php';

require_once __DIR__ . '/rules/frontend.php';
require_once __DIR__ . '/rules/backend.php';
require_once __DIR__ . '/rules/redirects.php';   // must stay last
