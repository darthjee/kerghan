<?php

namespace Tent\Middlewares\Tests;

use PHPUnit\Framework\TestCase;
use Tent\Middlewares\CanonicalHostHeaderMiddleware;
use Tent\Models\ProcessingRequest;

/**
 * Unit tests for CanonicalHostHeaderMiddleware.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 */
class CanonicalHostHeaderMiddlewareTest extends TestCase
{
    /**
     * @return array<string, array{0: string}> `[header name sent by the client]`.
     */
    public static function casingProvider(): array
    {
        return [
            'canonical' => ['Host'],
            'lower-case' => ['host'],
            'upper-case' => ['HOST'],
            'mixed casing' => ['hOsT'],
        ];
    }

    /**
     * Whatever its casing, the header ends up named `Host`, with its value.
     *
     * @dataProvider casingProvider
     */
    public function testRenamesAnyCasingToHost(string $name): void
    {
        $this->assertSame(
            ['Host' => 'client.example'],
            $this->process([$name => 'client.example'])
        );
    }

    /**
     * @return array<string, array{0: array<string, string>}> `[client headers]`.
     */
    public static function severalCasingsProvider(): array
    {
        return [
            'canonical first' => [['Host' => 'first.example', 'host' => 'second.example']],
            'canonical last' => [['host' => 'first.example', 'Host' => 'second.example']],
            'no canonical one' => [['HOST' => 'first.example', 'host' => 'second.example']],
            'three casings' => [
                ['hOsT' => 'first.example', 'Host' => 'second.example', 'host' => 'third.example'],
            ],
        ];
    }

    /**
     * With several casings a single `Host` remains, holding the first
     * occurrence's value.
     *
     * @dataProvider severalCasingsProvider
     *
     * @param array<string, string> $headers Headers sent by the client.
     */
    public function testKeepsOnlyTheFirstOccurrence(array $headers): void
    {
        $this->assertSame(['Host' => 'first.example'], $this->process($headers));
    }

    /**
     * Headers which merely look like `Host` are not host headers.
     */
    public function testLeavesOtherHeadersUntouched(): void
    {
        $result = $this->process([
            'X-Forwarded-Host' => 'forwarded.example',
            'host' => 'client.example',
            'Ho_st' => 'underscore.example',
            'Content-Type' => 'application/json',
        ]);

        $this->assertEquals([
            'X-Forwarded-Host' => 'forwarded.example',
            'Ho_st' => 'underscore.example',
            'Content-Type' => 'application/json',
            'Host' => 'client.example',
        ], $result);
        $this->assertCount(4, $result);
    }

    /**
     * No `Host` is invented for a request which carries none.
     */
    public function testAddsNothingWhenAbsent(): void
    {
        $this->assertSame(
            ['Content-Type' => 'application/json'],
            $this->process(['Content-Type' => 'application/json'])
        );
    }

    /**
     * @SuppressWarnings(PHPMD.StaticAccess) build() is the static factory
     *     contract mandated by the Tent middleware framework.
     */
    public function testBuildReturnsUsableInstance(): void
    {
        $middleware = CanonicalHostHeaderMiddleware::build([]);
        $request = new ProcessingRequest(['headers' => ['host' => 'client.example']]);

        $this->assertSame(['Host' => 'client.example'], $middleware->processRequest($request)->headers());
    }

    /**
     * Runs the middleware over a request carrying the given headers.
     *
     * @param array<string, string> $headers Headers sent by the client.
     * @return array<string, string> The headers left on the request.
     */
    private function process(array $headers): array
    {
        $request = new ProcessingRequest(['headers' => $headers]);

        return (new CanonicalHostHeaderMiddleware())->processRequest($request)->headers();
    }
}
