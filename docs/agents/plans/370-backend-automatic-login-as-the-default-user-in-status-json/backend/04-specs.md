# Specs

Cover every test listed under "Required tests" in
`docs/agents/specs/default-user/automatic-login.md` and `docs/agents/specs/default-user/security.md`
that concerns this issue:

- Unit (`default-user.service.spec.ts`): `autoLogin` returns `null` when the feature is off, the IP
  is disallowed, or no default user id is held; otherwise issues tokens with `keepSignedIn: false`.
  The boot warning is logged only when always-authenticated is on, names the username and the
  effective allowlist (including the loopback default), and contains no password.
- Unit (`auth.service.spec.ts`): an active token row wins over automatic login (including a row of
  another user); missing, unknown, expired and revoked tokens trigger automatic login from an
  allowed IP; nothing is revoked on any path.
- E2E (new `auth.controller.auto-login.e2e-spec.ts`, using `auth.controller.e2e-test-support.ts`):
  - no cookie from an allowed IP: body is exactly `{ loggedIn: true, isAdmin }`, with `isAdmin`
    from the default user; the three cookies match `login.json`'s names and attributes
    (`httpOnly`, `secure`, `sameSite`, `path`, `maxAge`); the session is `keepSignedIn: false`
    with the regular TTL;
  - disallowed IP, and feature off: exactly `{ loggedIn: false, isAdmin: false }` with the
    session cookies cleared;
  - a forged `X-Forwarded-For` beyond the trusted hops is ignored;
  - an existing valid session wins, including an explicit login as another user;
  - an expired access token with a valid refresh cookie is not auto-logged-in;
  - a protected endpoint without a cookie still returns `401`;
  - after logout, the next `status.json` logs in again;
  - the `X-Skip-Cache` header is present on the automatic-login response;
  - the new session is listed in `sessions/mine.json` as `current`, with `keepSignedIn: false`.

## Files to Change
- `backend/src/auth/tests/default-user.service.spec.ts` — `autoLogin` and boot-warning specs.
- `backend/src/auth/tests/default-user.config.spec.ts` — effective-allowlist accessor specs.
- `backend/src/auth/tests/auth.service.spec.ts` — `status` automatic-login specs.
- `backend/src/auth/tests/auth.controller.auto-login.e2e-spec.ts` — new e2e spec.
