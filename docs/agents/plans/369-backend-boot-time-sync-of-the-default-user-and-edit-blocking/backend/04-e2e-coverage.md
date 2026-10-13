# End-to-end coverage

Add e2e specs through the existing auth test harness (`tests/support/build-auth-test-app.ts`, in-memory repos) so the HTTP contract is verified end to end with the feature enabled (provide a `DefaultUserConfig` built from enabled settings, and let `onApplicationBootstrap` run, or seed the id through the service).

- `PATCH /auth/account.json` as the default user with `username` / `email` / `newPassword` → `409`, body `{ error: { code: 'DEFAULT_USER_MANAGED', message: 'This user is managed by environment configuration and cannot be edited' }, statusCode: 409, timestamp }`, no `error.details`, nothing changed.
- `POST /admin/users/:id/edit.json`, `recovery-link.json`, `send-recovery-email.json` on the default user → same `409`; unknown id → `404`; the default user editing itself as an admin is blocked.
- `POST /auth/recover.json` with the default user's email → `200 { sent: true }`, no token.
- `POST /auth/reset-password.json` with a valid default-user token → `409`, token still usable afterwards (not consumed).
- Identity by id: a stored username differing in case/accents from the configured one is still blocked.
- Feature disabled → same requests behave as today (including for a row created by an earlier enabled boot).

Put these in new files (e.g. `auth.controller.default-user.e2e-spec.ts`, `admin.controller.default-user.e2e-spec.ts`) rather than growing the existing e2e specs past the line limit. Extend `build-auth-test-app.ts` only as needed to override `DefaultUserConfig`.

## Files to Change
- `backend/src/auth/tests/auth.controller.default-user.e2e-spec.ts` — new.
- `backend/src/auth/tests/admin.controller.default-user.e2e-spec.ts` — new.
- `backend/src/auth/tests/support/build-auth-test-app.ts` — allow overriding `DefaultUserConfig` if needed.
