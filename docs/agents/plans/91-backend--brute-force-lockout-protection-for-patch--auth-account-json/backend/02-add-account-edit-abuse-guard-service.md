# Add `AccountEditAbuseGuardService`

New injectable service, `backend/src/auth/account-edit-abuse-guard.service.ts`, mirroring
`AuthorizationRequestAbuseGuardService`'s shape (constructor-injected repository + `ConfigService`,
no direct env-var reads outside private config-getter methods) but keyed by `userId` against the
new `AccountEditLockout` table instead of a request row:

- `isLockedOut(userId: number): Promise<boolean>` — loads (or treats a missing row as
  not-locked-out) the user's lockout row and checks `lockedUntil !== null && lockedUntil > new Date()`.
- `registerFailure(userId: number): Promise<void>` — upserts the row (create with
  `failedAttempts: 1` if none exists yet, otherwise increment), setting `lockedUntil` once the
  configured max-attempts threshold is reached — same increment-then-compare shape as
  `registerAuthorizeFailure`.
- `reset(userId: number): Promise<void>` — clears `failedAttempts`/`lockedUntil` on the user's row
  (no-op if no row exists), called after a successful account update.

Config keys, following the established `KERGHAN_<SCOPE>_<PARAM>` naming convention:
`KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS` (default `5`) and `KERGHAN_ACCOUNT_EDIT_LOCK_MS` (default
`300000`, 5 minutes) — same defaults as the `authorize` cool-off.

Register the service in `AuthModule`'s `providers` array (`backend/src/auth/auth.module.ts`).

## Files to Change

- `backend/src/auth/account-edit-abuse-guard.service.ts` — new service (see shape above).
- `backend/src/auth/auth.module.ts` — add `AccountEditAbuseGuardService` to `providers`.
