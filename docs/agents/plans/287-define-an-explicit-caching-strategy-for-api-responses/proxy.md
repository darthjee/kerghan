# Proxy Plan: Define an explicit caching strategy for API responses

Main plan: [plan.md](plan.md)

## Shared contracts

The proxy keeps its current behavior, which the strategy documents as-is:

- `default_proxy` for URIs ending in `.json`, with `skip_cache_header => 'X-Skip-Cache'`.
- `CacheCleanupMiddleware` with `clear => ['collection','entity']`.
- `CacheStalenessMiddleware` with `maxAgeSeconds => 10`. The backend's
  `PUBLIC_MAX_AGE_SECONDS` mirrors this value; change both together.

No method matcher is added. The backend forces non-GET/HEAD responses to send `X-Skip-Cache`.

## Implementation Steps

### Step 1 — Fix the stale rule comments and cross-reference the strategy
In both `rules/backend.php` files, replace "Node/Express backend" with "NestJS backend". Add a
short comment that:
- this rule is the opt-out API cache;
- routes opt out through the backend's `@CachePolicy()` → `X-Skip-Cache`;
- `maxAgeSeconds` must stay in sync with the backend's `PUBLIC_MAX_AGE_SECONDS`;
- the full strategy is in `docs/agents/architecture/caching.md`.

No functional changes.

## Files to Change
- `proxy/dev_configuration/rules/backend.php` — comments only.
- `proxy/prod_configuration/rules/backend.php` — comments only.

## Notes
- The prod `rules/backend.php` must still be uploaded with the other proxy configuration on
  release. Nothing changes in how that happens.
