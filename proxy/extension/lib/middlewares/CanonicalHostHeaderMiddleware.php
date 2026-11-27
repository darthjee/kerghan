<?php

namespace Tent\Middlewares;

use Tent\Models\ProcessingRequest;

/**
 * Collapses every casing of the client's `host` request header into a single
 * `Host` header, so Tent's own `Host` rewrite always applies to it.
 *
 * ## Why this exists
 *
 * `default_proxy` moves the client's `Host` to `X-Forwarded-Host` and sets
 * `Host` to the upstream host. Tent's `RenameHeaderMiddleware` looks the
 * header up case-sensitively (up to at least 1.3.0), but the web server hands
 * PHP the name exactly as the client wrote it. A hand-crafted `host` or
 * `HOST` header therefore escaped the rename and reached the upstream as the
 * client's own `Host`, next to Tent's. An upstream edge routing by `Host`
 * could then let another service answer, and the shared cache would keep that
 * answer for everyone.
 *
 * Remove this class, or recheck it, once Tent matches the name
 * case-insensitively.
 *
 * ## Several casings
 *
 * The first occurrence wins, in the order the web server lists the headers,
 * and every other one is dropped. The Apache shipped in the Tent image never
 * gets that far: it answers `400` to a request with more than one `Host`
 * line, whatever the casing. This only matters under a web server which lets
 * several through. Whichever value is kept, Tent's rename moves it to
 * `X-Forwarded-Host`, so no client value reaches the upstream as `Host`.
 *
 * This middleware is not configurable.
 *
 * ## Usage in configuration
 *
 * It must run **before** the handler's built-in middlewares, so it goes under
 * the rule's `prependMiddlewares` key, never under `middlewares` (whose
 * entries run after the rename):
 *
 * ```php
 * Configuration::buildRule([
 *     'handler' => [...],
 *     'matchers' => [...],
 *     'prependMiddlewares' => [
 *         [
 *             'class' => 'Tent\\Middlewares\\CanonicalHostHeaderMiddleware'
 *         ]
 *     ]
 * ]);
 * ```
 */
class CanonicalHostHeaderMiddleware extends Middleware
{
    private const HEADER_NAME = 'Host';

    /**
     * Builds a CanonicalHostHeaderMiddleware instance.
     *
     * @SuppressWarnings(PHPMD.UnusedFormalParameter) $attributes is required
     *     by the base Middleware::build() contract.
     *
     * @param array $attributes Unused; present to satisfy the base
     *                           Middleware::build() contract.
     * @return CanonicalHostHeaderMiddleware The constructed middleware instance.
     */
    public static function build(array $attributes): CanonicalHostHeaderMiddleware
    {
        return new self();
    }

    /**
     * Replaces every `host` header, whatever its casing, with a single `Host`
     * carrying the first occurrence's value, leaving every other header
     * untouched. A request without such a header is left without one.
     *
     * @param ProcessingRequest $request The request to process.
     * @return ProcessingRequest The request, with at most one `host` header,
     *                            named `Host`.
     */
    public function processRequest(ProcessingRequest $request): ProcessingRequest
    {
        $values = [];

        foreach ($request->headers() as $name => $value) {
            if (strcasecmp($name, self::HEADER_NAME) === 0) {
                $values[] = $value;
                $request->removeHeader($name);
            }
        }

        if ($values !== []) {
            $request->setHeader(self::HEADER_NAME, $values[0]);
        }

        return $request;
    }
}
