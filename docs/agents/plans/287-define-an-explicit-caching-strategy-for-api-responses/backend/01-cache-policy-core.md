# Introduce cache classes and the CachePolicy decorator/interceptor

Replace the boolean `@SkipCache()` mechanism with an explicit cache class, per the shared
contract in [plan.md](../plan.md#shared-contracts).

- Create `core/cache-class.ts` with the `CacheClass` enum, `SKIP_CACHE_HEADER`, and
  `PUBLIC_MAX_AGE_SECONDS`. Moving `SKIP_CACHE_HEADER` here removes the `core/` → `auth/` import.
- Create `core/cache-policy.decorator.ts`: `CachePolicy(cacheClass)` sets `CACHE_CLASS_KEY`
  metadata, usable on a class or a method.
- Replace `SkipCacheInterceptor` with `CachePolicyInterceptor`. It reads the class through
  `Reflector.getAllAndOverride` (handler first, then controller) and sets `X-Skip-Cache` and
  `Cache-Control` per the header table before calling `next.handle()`. Any method other than
  GET/HEAD is forced to the `never` headers. If no class is declared, it does nothing.
- Register it in `app.module.ts` (the `APP_INTERCEPTOR` at line ~120) and in
  `auth/tests/support/build-auth-test-app.ts`.
- Delete `skip-cache.decorator.ts` and `skip-cache.interceptor.ts`, and update
  `core/boolean-metadata.ts`'s doc comment if it still names the old interceptor.
- Remove `SKIP_CACHE_HEADER` and the `res.set(SKIP_CACHE_HEADER, 'true')` line from
  `auth/auth-response.ts`, and update its JSDoc.
- Replace `core/tests/skip-cache.interceptor.spec.ts` with `cache-policy.interceptor.spec.ts`.
  Cover:
  - each class on GET;
  - non-GET forced to `never`;
  - route-level override of the controller class;
  - no metadata means no headers.

## Files to Change
- `backend/src/core/cache-class.ts` — new: enum and constants.
- `backend/src/core/cache-policy.decorator.ts` — new: decorator.
- `backend/src/core/cache-policy.interceptor.ts` — new: replaces `skip-cache.interceptor.ts`.
- `backend/src/core/skip-cache.decorator.ts`, `backend/src/core/skip-cache.interceptor.ts` — delete.
- `backend/src/core/boolean-metadata.ts` — doc comment only, if needed.
- `backend/src/app.module.ts` — register the new interceptor.
- `backend/src/auth/auth-response.ts` — drop the constant and the manual header.
- `backend/src/auth/tests/support/build-auth-test-app.ts` — register the new interceptor.
- `backend/src/core/tests/cache-policy.interceptor.spec.ts` — new spec, replacing
  `skip-cache.interceptor.spec.ts`.
