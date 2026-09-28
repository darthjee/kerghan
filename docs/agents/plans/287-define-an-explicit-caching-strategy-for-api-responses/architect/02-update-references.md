# Point existing docs and agent definitions at the strategy

Update the docs that describe `X-Skip-Cache` as an exception for user-scoped responses only.
Each should state the opt-out default and link to `architecture/caching.md` instead of
restating the rules.

- `docs/agents/architecture/proxy.md`:
  - fix "Express" → NestJS at line ~15;
  - rewrite the "Cache bypass" section to reference the classes;
  - mention the staleness and cleanup semantics.
- `docs/agents/cache-warmer.md`, `docs/agents/flow.md`, `docs/agents/summary.md`,
  `docs/agents/architecture/security.md`, `docs/agents/backend/routes/auth.md`,
  `docs/agents/modules/auth.md`: replace `@SkipCache()` wording with `@CachePolicy(...)` and
  link to the strategy.
- `.claude/agents/cache.md`: widen the read-only review from "user-scoped endpoints set
  `X-Skip-Cache`" to "every endpoint declares a cache class, and `never`/`user-scoped`
  endpoints (including operational ones such as health) send `X-Skip-Cache`". Only `public`
  GET endpoints may be added to Navi resources. Update its frontmatter `description`
  accordingly.
- `.claude/agents/proxy.md` and `.claude/agents/backend.md`: add a pointer to the strategy
  (backend: every new controller or route needs `@CachePolicy()`).

## Files to Change
- `docs/agents/architecture/proxy.md`
- `docs/agents/cache-warmer.md`
- `docs/agents/flow.md`
- `docs/agents/summary.md`
- `docs/agents/architecture/security.md`
- `docs/agents/backend/routes/auth.md`
- `docs/agents/modules/auth.md`
- `.claude/agents/cache.md`
- `.claude/agents/proxy.md`
- `.claude/agents/backend.md`
