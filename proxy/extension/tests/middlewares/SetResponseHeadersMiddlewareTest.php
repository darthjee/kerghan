<?php

namespace Tent\Middlewares\Tests;

use PHPUnit\Framework\TestCase;
use Tent\Middlewares\SetResponseHeadersMiddleware;
use Tent\Models\Response;

/**
 * Unit tests for SetResponseHeadersMiddleware.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 */
class SetResponseHeadersMiddlewareTest extends TestCase
{
    private const HEADERS = [
        'Cache-Control' => 'no-store',
        'Referrer-Policy' => 'no-referrer',
    ];

    /**
     * Builds a real Response instance with the given header lines.
     */
    private function makeResponse(array $headers): Response
    {
        return new Response(['headers' => $headers]);
    }

    /**
     * When none of the configured headers are present, they are appended in
     * configuration order after the existing headers.
     */
    public function testAddsHeadersWhenAbsent(): void
    {
        $response = $this->makeResponse(['Content-Type: text/html']);
        $middleware = new SetResponseHeadersMiddleware(self::HEADERS);

        $result = $middleware->processResponse($response);

        $this->assertSame([
            'Content-Type: text/html',
            'Cache-Control: no-store',
            'Referrer-Policy: no-referrer',
        ], $result->headers());
    }

    /**
     * Existing occurrences of configured headers are replaced, rather than
     * resulting in duplicate header lines.
     */
    public function testReplacesExistingHeaders(): void
    {
        $response = $this->makeResponse([
            'Cache-Control: max-age=86400',
            'Content-Type: text/html',
            'Referrer-Policy: strict-origin-when-cross-origin',
        ]);
        $middleware = new SetResponseHeadersMiddleware(self::HEADERS);

        $result = $middleware->processResponse($response);

        $this->assertSame([
            'Content-Type: text/html',
            'Cache-Control: no-store',
            'Referrer-Policy: no-referrer',
        ], $result->headers());
    }

    /**
     * Every occurrence of a configured header is removed case-insensitively,
     * leaving unrelated headers untouched and in order.
     */
    public function testReplacesAllOccurrencesCaseInsensitively(): void
    {
        $response = $this->makeResponse([
            'cache-control: public, max-age=3600',
            'X-Request-Id: abc-123',
            'CACHE-CONTROL: no-cache',
            'referrer-policy: origin',
        ]);
        $middleware = new SetResponseHeadersMiddleware(self::HEADERS);

        $result = $middleware->processResponse($response);

        $this->assertSame([
            'X-Request-Id: abc-123',
            'Cache-Control: no-store',
            'Referrer-Policy: no-referrer',
        ], $result->headers());
    }

    /**
     * With an empty header map the response headers are left unchanged.
     */
    public function testLeavesHeadersUntouchedWhenMapIsEmpty(): void
    {
        $response = $this->makeResponse(['Content-Type: text/html']);
        $middleware = new SetResponseHeadersMiddleware([]);

        $result = $middleware->processResponse($response);

        $this->assertSame(['Content-Type: text/html'], $result->headers());
    }

    /**
     * build() reads the 'headers' map from the given attributes.
     *
     * @SuppressWarnings(PHPMD.StaticAccess) SetResponseHeadersMiddleware::build()
     *     is the static factory contract mandated by the Tent middleware
     *     framework; this test exists specifically to exercise it.
     */
    public function testBuildUsesHeadersAttribute(): void
    {
        $middleware = SetResponseHeadersMiddleware::build(['headers' => self::HEADERS]);
        $response = $this->makeResponse([]);

        $result = $middleware->processResponse($response);

        $this->assertSame([
            'Cache-Control: no-store',
            'Referrer-Policy: no-referrer',
        ], $result->headers());
    }

    /**
     * build() defaults to an empty header map when no attribute is provided.
     *
     * @SuppressWarnings(PHPMD.StaticAccess) SetResponseHeadersMiddleware::build()
     *     is the static factory contract mandated by the Tent middleware
     *     framework; this test exists specifically to exercise it.
     */
    public function testBuildDefaultsToNoHeaders(): void
    {
        $middleware = SetResponseHeadersMiddleware::build([]);
        $response = $this->makeResponse(['Content-Type: text/html']);

        $result = $middleware->processResponse($response);

        $this->assertSame(['Content-Type: text/html'], $result->headers());
    }
}
