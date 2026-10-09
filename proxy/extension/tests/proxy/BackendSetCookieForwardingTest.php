<?php

namespace Tent\Tests\Proxy;

use PHPUnit\Framework\TestCase;
use Tent\Configuration;
use Tent\Log\Logger;
use Tent\Log\NullLoggerInstance;
use Tent\Models\Request;
use Tent\Service\RequestProcessor;
use Tent\Service\ResponseSender;
use Tent\Tests\Support\StubUpstreamServer;

/**
 * End-to-end check that every `Set-Cookie` header an upstream response
 * carries reaches the client through Kerghan's backend (`*.json`) rule
 * (issue #324).
 *
 * The backend's login sets three cookies (access_token, refresh_token,
 * logged_in) and logoff clears all three, each as its own `Set-Cookie`
 * line. Tent before 1.0.0 emitted response headers with PHP's default
 * `header($line)` (replace = true), so only the last cookie survived; Tent
 * 1.0.3 sends them through `ResponseSender` with replace = false.
 *
 * The request goes through the same path as Tent's `index.php`:
 * `RequestProcessor` picks the rule, the `default_proxy` handler forwards it
 * over real curl to a stub upstream (`php -S`, see
 * support/upstream/session_cookies_router.php), the rule's middlewares run,
 * and `ResponseSender` emits the result. Only `ResponseSender`'s header
 * emitter is swapped for a recorder, since PHP's `header()` has no visible
 * effect under the CLI.
 *
 * The rule below mirrors proxy/dev_configuration/rules/backend.php (and its
 * prod twin) with the upstream host pointed at the stub; the configuration
 * folders aren't mounted into proxy_tests, so keep the two in sync.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 */
class BackendSetCookieForwardingTest extends TestCase
{
    private static StubUpstreamServer $upstream;

    private string $workDir;
    private string $previousDir;

    /**
     * @var array<int, array{0: string, 1: bool}> Recorded `[line, replace]` header emissions.
     */
    private array $emitted = [];

    public static function setUpBeforeClass(): void
    {
        // Keep the handler's upstream debug lines out of the PHPUnit output.
        Logger::setInstance(new NullLoggerInstance());

        self::$upstream = new StubUpstreamServer(__DIR__ . '/../support/upstream/session_cookies_router.php');
        self::$upstream->start();
    }

    public static function tearDownAfterClass(): void
    {
        self::$upstream->stop();
    }

    protected function setUp(): void
    {
        // Run inside a scratch folder so the rule's relative './cache'
        // (default_proxy's default cache folder and $cacheFolder in
        // locals.php) never touches the image's own working directory.
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
     * Login: access_token, refresh_token and logged_in all reach the client.
     */
    public function testLoginForwardsAllThreeSessionCookies(): void
    {
        $this->send('POST', '/auth/login.json', '{"login":"user","password":"secret"}');

        $this->assertSame(
            [
                'Set-Cookie: access_token=stub-access-jwt; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Strict',
                'Set-Cookie: refresh_token=stub-refresh-token; Max-Age=2592000; Path=/auth; HttpOnly; Secure; '
                    . 'SameSite=Strict',
                'Set-Cookie: logged_in=1; Max-Age=2592000; Path=/; Secure; SameSite=Strict',
            ],
            $this->emittedSetCookies()
        );
    }

    /**
     * Logoff: the clearing lines for all three cookies reach the client.
     */
    public function testLogoffForwardsAllThreeClearedCookies(): void
    {
        $this->send('DELETE', '/auth/logoff.json');

        $this->assertSame(
            [
                'Set-Cookie: access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; '
                    . 'SameSite=Strict',
                'Set-Cookie: refresh_token=; Path=/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; '
                    . 'SameSite=Strict',
                'Set-Cookie: logged_in=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict',
            ],
            $this->emittedSetCookies()
        );
    }

    /**
     * Every header line is emitted without replacing earlier ones; with
     * replace = true PHP would keep only the last `Set-Cookie`.
     */
    public function testHeadersAreEmittedWithoutReplacing(): void
    {
        $this->send('POST', '/auth/login.json', '{}');

        $this->assertNotEmpty($this->emitted);
        $this->assertSame([false], array_values(array_unique(array_column($this->emitted, 1))));
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
     * Processes a request through the configured rules and sends the
     * response, recording every emitted header line.
     */
    private function send(string $method, string $path, string $body = ''): void
    {
        $request = new Request([
            'requestMethod' => $method,
            'requestPath' => $path,
            'query' => '',
            'body' => $body,
            'headers' => [
                'Host' => 'localhost:3000',
                'Content-Type' => 'application/json',
            ],
            'uploadedFiles' => [],
            'postFields' => [],
        ]);

        $response = RequestProcessor::handleRequest($request);

        $sender = new ResponseSender(
            function (string $line, bool $replace): void {
                $this->emitted[] = [$line, $replace];
            },
            function (int $code): void {
                // Status is irrelevant here; http_response_code() would fail
                // once PHPUnit has produced output.
            }
        );

        ob_start();
        $sender->send($response);
        ob_end_clean();
    }

    /**
     * @return string[] The emitted `Set-Cookie` lines, in order.
     */
    private function emittedSetCookies(): array
    {
        return array_values(array_filter(
            array_column($this->emitted, 0),
            static fn(string $line): bool => stripos($line, 'Set-Cookie:') === 0
        ));
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
