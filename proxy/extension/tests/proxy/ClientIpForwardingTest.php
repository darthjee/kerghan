<?php

namespace Tent\Tests\Proxy;

use PHPUnit\Framework\TestCase;
use Tent\Configuration;
use Tent\Log\Logger;
use Tent\Log\NullLoggerInstance;
use Tent\Models\Request;
use Tent\Service\RequestProcessor;
use Tent\Tests\Support\StubUpstreamServer;

/**
 * End-to-end check that the backend only ever receives Tent's own view of the
 * client address in `X-Forwarded-For` through Kerghan's backend (`*.json`)
 * rule, whatever the client sent (issue #612).
 *
 * The standalone distribution's automatic login trusts one proxy hop
 * (`KERGHAN_TRUSTED_PROXY_HOPS=1`) against an IP allowlist, so a
 * client-supplied entry surviving, or Tent appending one of its own after
 * `SetClientIpMiddleware`, would be an authentication bypass. This guards the
 * whole chain, middleware ordering included, on every Tent upgrade;
 * `SetClientIpMiddlewareTest` covers the middleware in isolation.
 *
 * The request goes through the same path as Tent's `index.php`:
 * `RequestProcessor` picks the rule, the `default_proxy` handler runs its own
 * middlewares and the rule's ones, and forwards the request over real curl to
 * a stub upstream (`php -S`, see support/upstream/echo_headers_router.php)
 * which echoes the headers it received.
 *
 * The rule below mirrors proxy/dev_configuration/rules/backend.php (and its
 * prod twin) with the upstream host pointed at the stub; the configuration
 * folders aren't mounted into proxy_tests, so keep the two in sync.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 */
class ClientIpForwardingTest extends TestCase
{
    /**
     * The connecting peer's address. Deliberately not the loopback address the
     * stub upstream is reached through, so the two can't be confused.
     */
    private const REMOTE_ADDR = '192.0.2.44';

    private static StubUpstreamServer $upstream;

    private string $workDir;
    private string $previousDir;
    private ?string $previousRemoteAddr;

    public static function setUpBeforeClass(): void
    {
        // Keep the handler's upstream debug lines out of the PHPUnit output.
        Logger::setInstance(new NullLoggerInstance());

        self::$upstream = new StubUpstreamServer(__DIR__ . '/../support/upstream/echo_headers_router.php');
        self::$upstream->start();
    }

    public static function tearDownAfterClass(): void
    {
        self::$upstream->stop();
    }

    protected function setUp(): void
    {
        $this->previousRemoteAddr = $_SERVER['REMOTE_ADDR'] ?? null;
        $_SERVER['REMOTE_ADDR'] = self::REMOTE_ADDR;

        // Run inside a scratch folder so the rule's relative './cache' never
        // touches the image's own working directory.
        $this->previousDir = getcwd();
        $this->workDir = sys_get_temp_dir() . '/kerghan_proxy_test_' . bin2hex(random_bytes(6));
        mkdir($this->workDir);
        chdir($this->workDir);

        Configuration::reset();
        $this->buildBackendRule(self::$upstream->url(), './cache');
    }

    protected function tearDown(): void
    {
        Configuration::reset();
        chdir($this->previousDir);
        $this->removeDir($this->workDir);

        if ($this->previousRemoteAddr === null) {
            unset($_SERVER['REMOTE_ADDR']);
            return;
        }

        $_SERVER['REMOTE_ADDR'] = $this->previousRemoteAddr;
    }

    /**
     * @return array<string, array{0: string, 1: array<string, string>}> `[method, client headers]`.
     */
    public static function clientHeadersProvider(): array
    {
        return [
            'forged chain' => ['POST', ['X-Forwarded-For' => '203.0.113.9, 198.51.100.7']],
            'forged chain, lower-case name' => ['POST', ['x-forwarded-for' => '203.0.113.9, 198.51.100.7']],
            'forged chain on a cacheable method' => ['GET', ['X-Forwarded-For' => '203.0.113.9, 198.51.100.7']],
            'forged entries under two casings' => [
                'POST',
                ['X-Forwarded-For' => '203.0.113.9', 'x-forwarded-for' => '198.51.100.7'],
            ],
            'no client header' => ['POST', []],
        ];
    }

    /**
     * The upstream receives exactly one `X-Forwarded-For`, holding exactly one
     * entry: the request's `REMOTE_ADDR`.
     *
     * @dataProvider clientHeadersProvider
     *
     * @param array<string, string> $clientHeaders Extra headers sent by the client.
     */
    public function testUpstreamReceivesOnlyTheRemoteAddress(string $method, array $clientHeaders): void
    {
        $received = $this->forward($method, '/auth/status.json', $clientHeaders);

        $names = array_filter(
            array_keys($received['headers']),
            static fn(string $name): bool => strcasecmp($name, 'X-Forwarded-For') === 0
        );

        $this->assertCount(1, $names);
        $this->assertSame(self::REMOTE_ADDR, $received['forwardedFor']);
    }

    /**
     * Mirror of proxy/dev_configuration/rules/backend.php.
     */
    private function buildBackendRule(string $backendHost, string $cacheFolder): void
    {
        Configuration::buildRule([
            'handler' => [
                'type' => 'default_proxy',
                'host' => $backendHost,
                'skip_cache_header' => 'X-Skip-Cache'
            ],
            'matchers' => [
                ['uri' => '.json', 'type' => 'ends_with']
            ],
            'middlewares' => [
                [
                    'class' => 'Tent\\Middlewares\\SetClientIpMiddleware'
                ],
                [
                    'class'    => 'Tent\\Middlewares\\CacheCleanupMiddleware',
                    'location' => $cacheFolder,
                    'clear'    => ['collection', 'entity']
                ],
                [
                    'class' => 'Tent\\Middlewares\\CacheStalenessMiddleware',
                    'location' => $cacheFolder,
                    'host' => $backendHost,
                    'maxAgeSeconds' => 10
                ]
            ]
        ]);
    }

    /**
     * Processes a client request through the configured rules.
     *
     * @param array<string, string> $clientHeaders Extra headers sent by the client.
     * @return array{headers: array<string, string>, forwardedFor: string|null} What the upstream
     *                                                                         received.
     */
    private function forward(string $method, string $path, array $clientHeaders): array
    {
        $request = new Request([
            'requestMethod' => $method,
            'requestPath' => $path,
            'query' => '',
            'body' => '',
            'headers' => array_merge(['Host' => 'localhost:3000'], $clientHeaders),
            'uploadedFiles' => [],
            'postFields' => [],
        ]);

        $response = RequestProcessor::handleRequest($request);

        $this->assertSame(200, $response->httpCode());

        return json_decode($response->body(), true);
    }

    private function removeDir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        foreach (array_diff(scandir($dir), ['.', '..']) as $entry) {
            $path = $dir . '/' . $entry;
            is_dir($path) ? $this->removeDir($path) : unlink($path);
        }

        rmdir($dir);
    }
}
