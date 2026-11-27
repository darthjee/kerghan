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
 * End-to-end check that no client value ever reaches the backend as `Host`
 * through Kerghan's backend (`*.json`) rule, whatever casing the client gave
 * the header name (issue #612).
 *
 * Tent's `default_proxy` renames `Host` to `X-Forwarded-Host`
 * case-sensitively, so `CanonicalHostHeaderMiddleware` has to run first, from
 * the rule's `prependMiddlewares`. A client-chosen upstream `Host` could let
 * another service of a `Host`-routing edge answer, and the shared cache would
 * keep that answer. This guards the whole chain, middleware ordering included,
 * on every Tent upgrade; `CanonicalHostHeaderMiddlewareTest` covers the
 * middleware in isolation.
 *
 * The request goes through the same path as Tent's `index.php`:
 * `RequestProcessor` picks the rule, the `default_proxy` handler runs the
 * rule's prepended middlewares, its own ones and the rule's others, and
 * forwards the request over real curl to a stub upstream (`php -S`, see
 * support/upstream/echo_headers_router.php) which echoes the headers it
 * received.
 *
 * The rule below mirrors proxy/dev_configuration/rules/backend.php, its prod
 * twin and standalone/vault/tent/configuration/rules/backend.php, with the
 * upstream host pointed at the stub. The configuration folders aren't mounted
 * into proxy_tests, so none of those files is loaded here: keep them in sync.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 */
class HostHeaderForwardingTest extends TestCase
{
    private static StubUpstreamServer $upstream;

    private string $workDir;
    private string $previousDir;

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
    }

    /**
     * @return array<string, array{0: string, 1: array<string, string>}> `[method, client headers]`.
     *                                                                   The first value of each set
     *                                                                   is `client.example`.
     */
    public static function clientHeadersProvider(): array
    {
        $first = 'client.example';
        $other = 'other.example';

        return [
            'canonical' => ['POST', ['Host' => $first]],
            'lower-case' => ['POST', ['host' => $first]],
            'lower-case on a cacheable method' => ['GET', ['host' => $first]],
            'upper-case' => ['POST', ['HOST' => $first]],
            'mixed casing' => ['POST', ['hOsT' => $first]],
            'two casings, canonical first' => ['POST', ['Host' => $first, 'host' => $other]],
            'two casings, canonical last' => ['GET', ['host' => $first, 'Host' => $other]],
            'two casings, no canonical one' => ['POST', ['HOST' => $first, 'host' => $other]],
            'three casings' => ['POST', ['hOsT' => $first, 'Host' => $other, 'host' => $other]],
            'forged X-Forwarded-Host' => ['POST', ['X-Forwarded-Host' => $other, 'host' => $first]],
        ];
    }

    /**
     * The upstream receives exactly one host header, `Host`, naming the
     * upstream itself, and the client's (first) value as `X-Forwarded-Host`,
     * just like for a canonical `Host`.
     *
     * @dataProvider clientHeadersProvider
     *
     * @param array<string, string> $clientHeaders Headers sent by the client.
     */
    public function testUpstreamNeverReceivesTheClientHost(string $method, array $clientHeaders): void
    {
        $received = $this->forward($method, '/auth/status.json', $clientHeaders);

        $this->assertSame(['Host' => $this->upstreamHost()], $this->headersNamed($received, 'Host'));
        $this->assertSame($this->upstreamHost(), $received['host']);
        $this->assertSame(
            ['X-Forwarded-Host' => 'client.example'],
            $this->headersNamed($received, 'X-Forwarded-Host')
        );
    }

    /**
     * A request without any host header still reaches the upstream with the
     * upstream's own `Host`, and nothing is made up for `X-Forwarded-Host`.
     */
    public function testRequestWithoutHostGetsNoForwardedHost(): void
    {
        $received = $this->forward('POST', '/auth/status.json', []);

        $this->assertSame(['Host' => $this->upstreamHost()], $this->headersNamed($received, 'Host'));
        $this->assertSame($this->upstreamHost(), $received['host']);
        $this->assertSame([], $this->headersNamed($received, 'X-Forwarded-Host'));
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
            'prependMiddlewares' => [
                [
                    'class' => 'Tent\\Middlewares\\CanonicalHostHeaderMiddleware'
                ]
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
     * @param array<string, string> $clientHeaders Headers sent by the client.
     * @return array{headers: array<string, string>, host: string|null} What the upstream received.
     */
    private function forward(string $method, string $path, array $clientHeaders): array
    {
        $request = new Request([
            'requestMethod' => $method,
            'requestPath' => $path,
            'query' => '',
            'body' => '',
            'headers' => $clientHeaders,
            'uploadedFiles' => [],
            'postFields' => [],
        ]);

        $response = RequestProcessor::handleRequest($request);

        $this->assertSame(200, $response->httpCode());

        return json_decode($response->body(), true);
    }

    /**
     * @param array{headers: array<string, string>} $received What the upstream received.
     * @return array<string, string> The received headers with that name, whatever their casing.
     */
    private function headersNamed(array $received, string $name): array
    {
        return array_filter(
            $received['headers'],
            static fn(string $header): bool => strcasecmp($header, $name) === 0,
            ARRAY_FILTER_USE_KEY
        );
    }

    /**
     * @return string The stub upstream's `host:port`, which Tent sets as `Host`.
     */
    private function upstreamHost(): string
    {
        return substr(self::$upstream->url(), strlen('http://'));
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
