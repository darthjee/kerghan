# Write the caching strategy document

Create `docs/agents/architecture/caching.md` as the single source of truth for API caching.
Cover:

- **Default:** Tent shared-caches every 2xx response to a `*.json` URL (opt-out). The cache key
  is the query string only and ignores the HTTP method, so `X-Skip-Cache` is the only
  protection.
- **Cache classes:** `public`, `user-scoped`, and `never`, with how to pick one and examples:
  - auth, tokens, and admin are `never`;
  - `health.json` is `never`, because operational endpoints must always reach the backend;
  - reference data readable by anyone is `public`.
  Every route must declare a class through `@CachePolicy()`. The coverage spec enforces this.
- **Header table:** copy it from the plan's shared contracts. Explain that methods other than
  GET/HEAD are always `never`.
- **Freshness:** `CacheStalenessMiddleware` refreshes entries older than 10s in the background
  while still serving the stale copy (stale-while-revalidate, no hard expiry).
  `PUBLIC_MAX_AGE_SECONDS` mirrors this value.
- **Invalidation:** any POST/PATCH/PUT/DELETE clears the matching collection and entity cache
  directories. There is no cross-path map and no manual purge endpoint.
- **Navi:** only `public` GET endpoints may be warmed. Warm-up runs after tagged releases.
- **Future:** user-scoped responses stay uncached until Tent supports a per-user cache.

Link it from `docs/agents/architecture.md` (or the architecture index) and from
`docs/agents/index.md` if that index lists architecture docs.

## Files to Change
- `docs/agents/architecture/caching.md` — new strategy document.
- `docs/agents/architecture.md` / `docs/agents/index.md` — add the link.
