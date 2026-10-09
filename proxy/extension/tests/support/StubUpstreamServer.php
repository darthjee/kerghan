<?php

namespace Tent\Tests\Support;

use RuntimeException;

/**
 * Runs a throwaway upstream HTTP server (PHP's built-in `php -S`) on a free
 * loopback port for the lifetime of a test class, so proxy tests can go
 * through Tent's real curl client instead of a mocked HttpClientInterface.
 */
class StubUpstreamServer
{
    private const HOST = '127.0.0.1';
    private const BOOT_TIMEOUT_SECONDS = 5.0;

    /**
     * @var resource|null The `php -S` process handle.
     */
    private $process = null;

    private int $port;

    /**
     * @param string $routerScript Absolute path to the `php -S` router script.
     */
    public function __construct(private string $routerScript)
    {
    }

    /**
     * Starts the server and blocks until it accepts connections.
     *
     * @throws RuntimeException When the server cannot be started in time.
     */
    public function start(): void
    {
        $this->port = $this->freePort();

        $this->process = proc_open(
            [PHP_BINARY, '-S', self::HOST . ':' . $this->port, $this->routerScript],
            [0 => ['pipe', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
            $pipes
        );

        if (!is_resource($this->process)) {
            throw new RuntimeException('Could not start the stub upstream server');
        }

        $this->waitUntilListening();
    }

    /**
     * Stops the server.
     */
    public function stop(): void
    {
        if (is_resource($this->process)) {
            proc_terminate($this->process);
            proc_close($this->process);
        }

        $this->process = null;
    }

    /**
     * @return string The server base URL (e.g. `http://127.0.0.1:43210`).
     */
    public function url(): string
    {
        return 'http://' . self::HOST . ':' . $this->port;
    }

    /**
     * Asks the OS for a currently unused TCP port.
     */
    private function freePort(): int
    {
        $socket = stream_socket_server('tcp://' . self::HOST . ':0');
        $name = stream_socket_get_name($socket, false);
        fclose($socket);

        return (int) substr($name, strrpos($name, ':') + 1);
    }

    /**
     * Polls the port until the server accepts a connection.
     *
     * @throws RuntimeException When the server does not come up in time.
     */
    private function waitUntilListening(): void
    {
        $deadline = microtime(true) + self::BOOT_TIMEOUT_SECONDS;

        while (microtime(true) < $deadline) {
            $connection = @fsockopen(self::HOST, $this->port);

            if ($connection !== false) {
                fclose($connection);
                return;
            }

            usleep(50000);
        }

        $this->stop();
        throw new RuntimeException('Stub upstream server did not start on port ' . $this->port);
    }
}
