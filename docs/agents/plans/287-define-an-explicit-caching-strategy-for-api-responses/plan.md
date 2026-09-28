# Plan: Define an explicit caching strategy for API responses

Issue: [287-define-an-explicit-caching-strategy-for-api-responses.md](../../issues/287-define-an-explicit-caching-strategy-for-api-responses.md)

## Overview

Tent's opt-out model stays: every 2xx `*.json` response is shared-cached unless it carries
`X-Skip-Cache`. On the backend, `@SkipCache()` becomes an explicit per-endpoint cache class
(`public` / `user-scoped` / `never`). The class drives both `X-Skip-Cache` and a
browser-facing `Cache-Control` header. A spec fails when a route declares no class, and
`health.json` stops being cached. The architect writes the strategy document and updates
the existing docs and agent definitions to point at it. The proxy only gets a stale-comment
fix; its rule and middlewares stay unchanged.

## Agents involved

- [backend](backend.md)
- [proxy](proxy.md)
- [architect](architect.md)

## Shared contracts

**Cache classes** (`backend/src/core/cache-class.ts`):

```ts
export enum CacheClass {
  Public = 'public',          // shared-cacheable by Tent; the only class Navi may warm
  UserScoped = 'user-scoped', // per-caller data; never shared-cached (until Tent has per-user cache)
  Never = 'never',            // auth, tokens, admin, operational (health)
}
export const SKIP_CACHE_HEADER = 'X-Skip-Cache';
export const PUBLIC_MAX_AGE_SECONDS = 10; // mirrors Tent's CacheStalenessMiddleware maxAgeSeconds
```

**Decorator:** `@CachePolicy(CacheClass.X)` in `backend/src/core/cache-policy.decorator.ts`,
applied at controller or route level (route level overrides the controller). It replaces
`@SkipCache()`.

**Response headers set by the global `CachePolicyInterceptor`** (set before the handler runs,
so error responses carry them too):

| Class | `X-Skip-Cache` | `Cache-Control` |
|---|---|---|
| `public` (GET/HEAD) | *(absent)* | `public, max-age=10` |
| `user-scoped` | `true` | `private, no-store` |
| `never` | `true` | `no-store` |
| any class, method other than GET/HEAD | `true` | `no-store` |
| no class declared | *(absent: Tent's opt-out default)* | *(absent)* |

Tent's cache key ignores the HTTP method, so non-GET responses are never shared-cached. This is
enforced in the backend interceptor rather than with a proxy method matcher.

**Proxy:** `rules/backend.php` keeps `skip_cache_header => 'X-Skip-Cache'`,
`CacheCleanupMiddleware` (`clear => ['collection','entity']`), and
`CacheStalenessMiddleware` (`maxAgeSeconds => 10`) unchanged.

**Strategy doc path:** `docs/agents/architecture/caching.md`.
