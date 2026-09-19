# Add the SkipCache decorator and interceptor

Add a `@SkipCache()` metadata decorator plus a `SkipCacheInterceptor` under `backend/src/core/`, following the exact same shape already used by `Public`/`IS_PUBLIC_KEY` (`backend/src/core/public.decorator.ts`) and `AdminOnly`/`IS_ADMIN_ONLY_KEY` (`backend/src/core/admin-only.decorator.ts`), read back via `Reflector#getAllAndOverride` the same way `JwtGuard` (`backend/src/core/jwt.guard.ts`) already reads its own metadata.

`SkipCache()` sets a metadata key (e.g. `IS_SKIP_CACHE_KEY = 'isSkipCache'`) on the handler/class via `SetMetadata`. `SkipCacheInterceptor` implements `NestInterceptor`, constructor-injects `Reflector`, reads the metadata off `context.getHandler()`/`context.getClass()`, and when true, sets the `X-Skip-Cache` header (reuse the existing `SKIP_CACHE_HEADER` constant exported from `backend/src/auth/auth-response.ts` rather than redefining the string) on the underlying HTTP response before/after calling `next.handle()`. When the metadata is absent, it must no-op and simply pass through — it will be registered globally in step 02, so it must not affect any route that isn't annotated.

Add a unit spec for `SkipCacheInterceptor` (and `SkipCache()` if the existing decorator specs for `Public`/`AdminOnly` follow this pattern) in whichever test location mirrors the existing `core/` decorator/guard specs, verifying: metadata present → header set; metadata absent → header untouched.

## Files to Change
- `backend/src/core/skip-cache.decorator.ts` — new `SkipCache()` decorator + `IS_SKIP_CACHE_KEY` metadata key, mirroring `public.decorator.ts`.
- `backend/src/core/skip-cache.interceptor.ts` — new `SkipCacheInterceptor` implementing `NestInterceptor`, reading the metadata via `Reflector.getAllAndOverride` and setting `SKIP_CACHE_HEADER` (imported from `../auth/auth-response.js`) when present.
- New unit spec file for the interceptor (path to match this repo's existing convention for `core/` guard/decorator specs).
