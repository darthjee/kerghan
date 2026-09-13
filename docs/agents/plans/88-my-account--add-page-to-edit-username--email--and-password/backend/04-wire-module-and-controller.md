# Wire module and controller endpoint

Register the new service and expose the endpoint:

- Add `AccountService` to `AuthModule`'s `providers` (`backend/src/auth/auth.module.ts`,
  alongside the existing `AuthService, AdminService, PasswordResetService, TokenService,
  AuthorizationRequestService, AuthorizationRequestAbuseGuardService,
  PasswordRecoveryRequestedListener`).
- Add a `PATCH /auth/account.json` handler to `AuthController`
  (`backend/src/auth/auth.controller.ts`), following the existing thin-controller convention:
  - No `@Public()` — this route relies on the default (authenticated) guard.
  - `@Req() req: Request` to read `req.user!.sub` as the user id (same convention as
    `authorization-request.controller.ts:100-107`/`:123-134`), plus `@Body() dto:
    UpdateAccountDto`.
  - Set `X-Skip-Cache: true` via `res.set(SKIP_CACHE_HEADER, 'true')`, mirroring the existing
    calls at `auth.controller.ts:65,82,135,153` (needs `@Res({passthrough: true}) res: Response`
    if not already available on this handler).
  - Delegate directly to `AccountService#updateAccount(req.user!.sub, dto)` and return its result.

## Files to Change
- `backend/src/auth/auth.module.ts` — register `AccountService` as a provider.
- `backend/src/auth/auth.controller.ts` — add the `PATCH /auth/account.json` handler as described.
