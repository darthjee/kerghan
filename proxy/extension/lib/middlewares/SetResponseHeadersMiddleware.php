<?php

namespace Tent\Middlewares;

use Tent\Models\Response;

/**
 * Sets a fixed map of response headers, replacing any existing occurrence of
 * each configured header (case-insensitive) so the client always receives a
 * single, well-formed value per header.
 *
 * Headers not listed in the map are left untouched and in their original
 * order; the configured headers are appended after them, in map order.
 *
 * ## Why not `Tent\Middlewares\SetHeadersMiddleware`?
 *
 * Tent's built-in `SetHeadersMiddleware` only sets **request** headers (sent
 * upstream); it never touches the response the client receives. This class
 * is its response-side counterpart.
 *
 * ## Usage in configuration
 *
 * ```php
 * Configuration::buildRule([
 *     'handler' => [...],
 *     'matchers' => [...],
 *     'middlewares' => [
 *         [
 *             'class' => 'Tent\\Middlewares\\SetResponseHeadersMiddleware',
 *             'headers' => [
 *                 'Cache-Control' => 'no-store',
 *                 'Referrer-Policy' => 'no-referrer'
 *             ]
 *         ]
 *     ]
 * ]);
 * ```
 */
class SetResponseHeadersMiddleware extends Middleware
{
    /**
     * @var array<string, string> Header name => value map to set on the response.
     */
    private array $headers;

    /**
     * @param array<string, string> $headers Header name => value map to set on the response.
     */
    public function __construct(array $headers)
    {
        $this->headers = $headers;
    }

    /**
     * Builds a SetResponseHeadersMiddleware instance from given attributes.
     *
     * @param array $attributes Associative array of attributes; supports
     *                           'headers' (name => value map).
     * @return SetResponseHeadersMiddleware The constructed middleware instance.
     */
    public static function build(array $attributes): SetResponseHeadersMiddleware
    {
        return new self($attributes['headers'] ?? []);
    }

    /**
     * Removes every existing line of each configured header (case-insensitive),
     * then appends a single `Name: value` line per configured header.
     *
     * @param Response $response The response to process.
     * @return Response The response, with the configured headers set.
     */
    public function processResponse(Response $response): Response
    {
        $targetNames = array_map('strtolower', array_keys($this->headers));
        $filtered = [];

        foreach ($response->headers() as $headerLine) {
            $name = strtolower(trim(strstr($headerLine, ':', true) ?: $headerLine));

            if (in_array($name, $targetNames, true)) {
                continue;
            }

            $filtered[] = $headerLine;
        }

        foreach ($this->headers as $name => $value) {
            $filtered[] = $name . ': ' . $value;
        }

        $response->setHeaders($filtered);

        return $response;
    }
}
