# Issue: Define an explicit caching strategy for API responses

## Description
The Tent proxy caches API responses (every `*.json` URL), but the strategy is implicit and undocumented. Define explicitly which API endpoints are cacheable and which must never be, how long entries live and how they are invalidated, how this interacts with Navi cache warm-up, and document it so new endpoints follow it. This issue covers both the strategy document and the code changes needed to apply it.

## Problem
- `proxy/*_configuration/rules/backend.php` routes every `*.json` URI through Tent's `default_proxy`, which caches every 2xx response by default. The cache key ignores the HTTP method.
- Caching is **opt-out**: only controllers decorated with `@SkipCache()` (`AuthController`, `AdminController`, `AuthorizationRequestController`) send `X-Skip-Cache`. A new controller is cached unless someone remembers the decorator, and nothing enforces that.
- `GET /health.json` has no `@SkipCache`, so Tent caches it and a health check can report ok while the backend is down.
- There is no hard TTL: `CacheStalenessMiddleware` (`maxAgeSeconds => 10`) only schedules a background refresh, and stale entries are still served.
- Invalidation is a blanket `CacheCleanupMiddleware` (`clear => ['collection','entity']`) on any write. There is no custom map and no purge mechanism.
- The backend emits no `Cache-Control` / `ETag` headers on JSON responses.
- `X-Skip-Cache` is also set by hand in `auth/auth-response.ts`, and `SKIP_CACHE_HEADER` lives in `auth/` while `core/` imports it.
- Navi warms nothing yet (only `clients.yml` is included) and runs only after tagged releases.
- The docs describe `X-Skip-Cache` as an exception for user-scoped responses and never state that caching is the default for `*.json`, nor the staleness or invalidation semantics. `rules/backend.php` and `architecture/proxy.md` still call the backend "Express".

## Expected Behavior
- Caching stays **opt-out**: `*.json` 2xx responses are shared-cached by Tent unless the response carries `X-Skip-Cache`.
- Every API endpoint belongs to an explicit cache class:
  - **public**: cacheable by Tent and a Navi warm-up candidate.
  - **user-scoped**: never shared-cached, until Tent supports a per-user cache.
  - **never-cached**: auth, admin, tokens, and operational endpoints such as `health.json`.
- The current freshness and invalidation behavior is kept and documented. Entries older than 10s are refreshed in the background while the stale copy is still served, and writes clear the collection/entity entries.
- The backend sends browser-facing `Cache-Control` headers for each class: `no-store` for user-scoped and never-cached responses, and a short public `max-age` for public ones.
- Enforcement ensures a new endpoint cannot silently fall into the wrong class.

## Solution
- **Docs:** add a caching-strategy document under `docs/agents/` covering:
  - the opt-out default for `*.json`;
  - the endpoint classes and how each is declared;
  - the staleness and invalidation semantics, and that the cache key ignores the HTTP method;
  - the `Cache-Control` policy;
  - which classes Navi may warm (public only).
  Update `cache-warmer.md`, `flow.md`, `architecture/proxy.md`, `.claude/agents/proxy.md` and `.claude/agents/cache.md` to reference it, and fix the stale "Express" mentions.
- **Backend:**
  - Add `@SkipCache()` to `HealthController`.
  - Move `SKIP_CACHE_HEADER` into `core/` and drop the manual header in `auth/auth-response.ts` in favor of the interceptor.
  - Extend the cache decorator/interceptor so each class also emits the matching `Cache-Control` header.
- **Enforcement:** add a backend spec or lint rule that fails when a controller or route declares no cache class. Extend the `cache` agent's review rule to cover never-cached/operational endpoints as well as user-scoped ones.
- **Proxy:** keep the current opt-out rule and the staleness/cleanup middlewares. Make sure non-GET responses are never shared-cached, either by relying on the backend class headers or by adding a method restriction in `rules/backend.php` (to be decided in planning).

## Benefits
- Prevents accidental shared caching of user-scoped or operational responses, such as a cached health check hiding an outage.
- Gives new endpoints a clear, enforced rule to follow.
- Adds browser-level cache guidance to JSON responses.
- Makes Navi warm-up targets well-defined.
