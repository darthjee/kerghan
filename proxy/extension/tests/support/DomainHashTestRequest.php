<?php

namespace Tent\Cache\Tests;

use Tent\Models\RequestInterface;

/**
 * Minimal RequestInterface double carrying a fixed domain and query string.
 *
 * Deliberately independent of Tent's own Request/ProcessingRequest classes, so
 * the DomainHash tests control exactly what `RequestInterface::domain()` and
 * `query()` return. Like Tent's bare Request, it never records a cache
 * decision (`skipCache()` is a no-op).
 */
class DomainHashTestRequest implements RequestInterface
{
    public function __construct(private string $domain, private string $query)
    {
    }

    public function requestMethod()
    {
        return 'GET';
    }

    public function body()
    {
        return '';
    }

    public function headers()
    {
        return [];
    }

    public function requestPath(): string
    {
        return '/issues.json';
    }

    public function query()
    {
        return $this->query;
    }

    public function uploadedFiles(): array
    {
        return [];
    }

    public function postFields(): array
    {
        return [];
    }

    public function domain(): string
    {
        return $this->domain;
    }

    public function skipCache(): void
    {
    }

    public function cacheSkipped(): bool
    {
        return false;
    }
}
