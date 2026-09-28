# Add the cache-class coverage spec

Enforce the strategy: a route that declares no cache class must fail CI, because under Tent's
opt-out default it would be silently shared-cached.

Add `backend/src/core/tests/cache-policy.coverage.spec.ts`:

- Discover every `backend/src/**/*.controller.ts` file (for example with `fs` or `glob` relative
  to `src/`) and dynamically import it. For every exported class that carries Nest's controller
  metadata (`PATH_METADATA` on the class), walk the prototype methods that carry route metadata
  (`METHOD_METADATA` / `PATH_METADATA`).
- Assert that each route resolves a `CACHE_CLASS_KEY` value, either on the method or on the
  class. The failure message must name `Controller.method` and point to
  `docs/agents/architecture/caching.md`.
- Include a sanity assertion that at least the 4 known controllers were discovered, so a broken
  glob cannot pass vacuously.

This needs no database or app bootstrap, only static metadata.

## Files to Change
- `backend/src/core/tests/cache-policy.coverage.spec.ts` — new coverage spec.
