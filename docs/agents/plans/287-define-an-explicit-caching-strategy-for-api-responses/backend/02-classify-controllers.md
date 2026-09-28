# Classify every controller and fix health.json

Swap every `@SkipCache()` for an explicit `@CachePolicy(...)` and give `HealthController` a
class, so Tent stops caching `GET /health.json`.

- `AuthController`, `AuthorizationRequestController`, `AdminController`:
  `@CachePolicy(CacheClass.Never)` at controller level. These routes return credentials, tokens,
  or admin data. If any read route in `AuthController` only returns the caller's own account
  data, it may be overridden at route level with `CacheClass.UserScoped`. Document any such
  override in the controller's JSDoc.
- `HealthController`: `@CachePolicy(CacheClass.Never)`, so a health check always reaches the
  backend.
- Update controller JSDoc that mentions `@SkipCache()`.
- e2e specs: keep the existing `x-skip-cache` assertions, and add `cache-control` assertions
  (`no-store`) to `auth.controller.skip-cache.e2e-spec.ts`. Add a health e2e/unit assertion
  that `GET /health.json` responds with `X-Skip-Cache: true` and `Cache-Control: no-store`.

## Files to Change
- `backend/src/auth/auth.controller.ts` — `@CachePolicy(CacheClass.Never)`.
- `backend/src/auth/authorization-request.controller.ts` — `@CachePolicy(CacheClass.Never)`.
- `backend/src/auth/admin.controller.ts` — `@CachePolicy(CacheClass.Never)`.
- `backend/src/health/health.controller.ts` — `@CachePolicy(CacheClass.Never)`.
- `backend/src/auth/tests/auth.controller.skip-cache.e2e-spec.ts` — add `cache-control` assertions.
- `backend/src/health/tests/health.controller.spec.ts` (or a new health e2e spec) — assert the
  headers.
