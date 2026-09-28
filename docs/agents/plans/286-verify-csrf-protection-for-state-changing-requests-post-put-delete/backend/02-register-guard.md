# Register the guard globally and in the e2e test app
Add `{ provide: APP_GUARD, useClass: OriginGuard }` as the **first** `APP_GUARD` in `AppModule`, ahead of `JwtGuard`, and update the module's JSDoc to mention it. Nest runs global guards in registration order, so a forged request never reaches authentication and gets `403`, not `401`.

Register it the same way, first, in `build-auth-test-app.ts`, so the auth e2e specs run with the same guard chain as production. Update the comment block there that lists the providers. If `app.module.spec.ts` asserts the provider list, update it too.

## Files to Change
- `backend/src/app.module.ts` — register `OriginGuard` as the first `APP_GUARD` and update the JSDoc.
- `backend/src/auth/tests/support/build-auth-test-app.ts` — register `OriginGuard` first and update the comment.
- `backend/src/core/tests/app.module.spec.ts` — adjust if it asserts the guard providers.
