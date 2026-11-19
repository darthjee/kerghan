# Module — Auth

Kerghan's first backend module, and its only **always-on** module (imported directly into
`AppModule` — see `docs/agents/architecture/modular-pattern.md`'s classification). Owns
Kerghan's lightweight per-user login (username/password, independent of any GitHub handle — see
`docs/agents/product.md`). Ported from the pre-migration Express `Authenticator`/`Registrar`/
`UserSerializer` (`backend/lib/accounts/`, `backend/lib/serializers/`, now removed).


## Pages

| Page | Read when |
|---|---|
| [Routes, CSRF and Exports](auth/routes.md) | Looking up the compact route tables, admin tool routes, CSRF protection or what the module exports. |
| [Entities and JWT/refresh-token flow](auth/sessions.md) | Working on the `auth_` tables, sessions, token rotation or the session lookup. |
| [Device-authorization flow](auth/device-authorization.md) | Working on the device-authorization requests, status machine, poll token or abuse limits. |
| [Admin authorization and events](auth/admin-and-events.md) | Working on admin access rules or the `user.registered`, `user.deleted` and `password-recovery.requested` events. |
| [Default user](auth/default-user.md) | Working on the environment-configured default user and automatic login. |
| [GitHub handle](auth/github-handle.md) | Working on the optional GitHub handle and its account endpoints. |
| [User approval](auth/user-approval.md) | Working on pending/approved/denied statuses and admin review. |

## Testing

- `auth/tests/auth.service.spec.ts` — unit specs, mocked repositories, port of the old
  `Authenticator_spec.js`/`Registrar_spec.js` coverage plus the JWT/refresh/logout behavior.
- `auth/tests/auth.controller.e2e-spec.ts` — e2e specs via `supertest` against a real
  `INestApplication` with in-memory fake repositories (see `architecture/backend.md`'s Testing
  section): login flow, refresh-token rotation (including replay/expiry rejection), logout, and
  the global `JwtGuard` (public routes, missing/invalid/valid access token) against two
  throwaway controllers defined in the spec itself.
- `auth/tests/admin.service.spec.ts` — unit specs, mocked repositories: `searchUsers`
  with/without a query, `generateRecoveryLink`/`sendRecoveryEmail` user-found/not-found paths,
  and the mail `sent`/`skipped`/throwing outcomes for `sendRecoveryEmail`.
- `auth/tests/support/in-memory-repo.ts` — the single shared in-memory fake TypeORM repository
  (`createInMemoryRepo`/`matchesCondition`), re-exported by
  `auth/tests/auth.controller.e2e-test-support.ts` and
  `auth/tests/authorization-request.controller.e2e-test-support.ts`.
- `auth/tests/admin.controller.e2e-spec.ts` — e2e specs, built via the shared `buildTestApp({
  adminGuard: true, registerDefaultUser: false })` from `auth.controller.e2e-test-support.ts`,
  plus the global `JwtGuard`/`AdminGuard` pair registered as `APP_GUARD`s: unauthenticated (`401`)
  and authenticated-non-admin (`403`) rejection on every admin route, an admin caller's documented
  response shapes, `404` for an unknown user id, and `X-Skip-Cache: true` on every response.
- `core/tests/jwt.guard.spec.ts` (unit) and `auth/tests/auth.controller.session-gate.e2e-spec.ts`
  (e2e) — the session lookup: active session of `sub`, revoked/expired/unknown/foreign sessions,
  missing or malformed `sid` and `sub`, rotation, `request.user` from the DB (demotion, username
  change), immediate revocation after logoff and session revoke, and rule 3 (pending and denied
  users blocked, a pending session let through once approved).
- Default user and automatic login: see
  [Default user → Testing](auth/default-user.md#testing).
- User approval: see [User approval → Testing](auth/user-approval.md#testing).
