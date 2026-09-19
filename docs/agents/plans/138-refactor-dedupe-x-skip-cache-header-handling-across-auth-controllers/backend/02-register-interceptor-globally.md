# Register the interceptor globally

Register `SkipCacheInterceptor` as a global `APP_INTERCEPTOR` provider in `backend/src/app.module.ts`, the same way `JwtGuard` and `AdminGuard` are already registered as global `APP_GUARD` providers there. Because the interceptor no-ops when `@SkipCache()` metadata is absent (built in step 01), registering it globally is safe for every other route (e.g. the `@Public()` health check) and matches this codebase's existing pattern of global guards that self-gate on per-route metadata, instead of requiring `@UseInterceptors()` on each controller.

## Files to Change
- `backend/src/app.module.ts` — add `SkipCacheInterceptor` to the `providers` array as an `APP_INTERCEPTOR` multi-provider, alongside the existing `APP_GUARD` entries for `JwtGuard`/`AdminGuard`.
