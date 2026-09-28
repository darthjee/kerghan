# Backend Plan: Define an explicit caching strategy for API responses

Main plan: [plan.md](plan.md)

## Shared contracts

The backend **produces** the `CacheClass` enum, the `SKIP_CACHE_HEADER` /
`PUBLIC_MAX_AGE_SECONDS` constants, the `@CachePolicy()` decorator, and the header table from
[plan.md](plan.md#shared-contracts):

- `public` on GET/HEAD: no `X-Skip-Cache`; `Cache-Control: public, max-age=10`.
- `user-scoped`: `X-Skip-Cache: true`; `Cache-Control: private, no-store`.
- `never`, or any method other than GET/HEAD: `X-Skip-Cache: true`; `Cache-Control: no-store`.
- No class declared: no headers. This must never ship, because the coverage spec fails.

The backend **relies on** Tent honoring `X-Skip-Cache` on the response (unchanged proxy rule).

## Steps

- [01 — Introduce cache classes and the CachePolicy decorator/interceptor](backend/01-cache-policy-core.md)
- [02 — Classify every controller and fix health.json](backend/02-classify-controllers.md)
- [03 — Add the cache-class coverage spec](backend/03-coverage-spec.md)

## CI Checks

- `backend/`: `docker-compose run kerghan_tests yarn coverage` and
  `docker-compose run kerghan_tests yarn lint` (CI jobs: `backend_tests`, `backend_checks`).

## Notes

- Today no endpoint is `public`: every controller is auth, admin, or health. The `public` path
  is exercised only by unit specs until a public endpoint exists.
- `CacheTokenService` (`core/cache-token.service.ts`) has no callers and is out of scope.
- Don't rely on the manual `res.set` in `respondWithSession`. `@Res({ passthrough: true })`
  routes still go through the interceptor, so dropping it is safe as long as the owning
  controllers carry a class (they do, at controller level).
