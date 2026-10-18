# Auth route contracts

Fold the user-endpoint contracts from `specs/user-approval/api.md` into
`docs/agents/backend/routes/auth.md`. Each change goes under the existing heading for that
endpoint.

- **`POST /auth/register.json`**: the initial status comes from the flag. The response and
  cookies are unchanged for every status, so a pending user holds a session that the gate blocks.
- **`POST /auth/login.json`**:
  - the order of checks (wrong password → `401`; denied → `403 USER_DENIED` with no cookies;
    pending → `200`);
  - the `USER_DENIED` body;
  - a `403` does not trigger `ApiClient`'s refresh-and-retry.
- **`POST /auth/refresh.json`**:
  - pending keeps rotating;
  - denied gets the plain `401` with cookies cleared, and the still-active token is revoked with
    `admin_denied`. Why: a rotation can race the deny's bulk revoke;
  - the order of checks (existing token checks first, so replay detection is never skipped).
- **`POST /auth/status.json`**:
  - the four-row table (approved, pending, denied, no session);
  - `status` appears only for pending;
  - pending is the one `loggedIn: false` answer that keeps the cookies. Why: so the user can pick
    up an approval without logging in again;
  - automatic-login precedence is unchanged.

  Also update the "Session cookies" paragraph that says cookies are cleared on any
  `loggedIn: false`.
- **`POST /auth/recover.json` / `POST /auth/reset-password.json`**: if they aren't in this file,
  they belong to the "Default user `409`" section or `modules/auth.md`. Put the rules wherever
  those routes are documented:
  - recover gives the same observable answer for every status, and creates no token for a denied
    user;
  - reset with a denied user's token gives the generic `400` and does not consume the token;
  - a pending user can reset and stays pending.
- **`POST /auth/authorization-requests/:uuid/poll.json`**: the status re-check before minting
  and the `{ status: "denied" }` answer. Link to the status machine in `modules/auth.md`.
- **`POST /auth/authorization-requests/:uuid/authorize.json`**: a non-approved caller gets `401`
  from the gate before the endpoint runs.
- **`POST /auth/sessions/:uuid/revoke.json`** and **revoke-others**: replace "Revocation stops the
  refresh token only" with the immediate effect through the gate.
- **New "Error codes" note** (or extend an existing one): `USER_DENIED` (403), `USER_NOT_PENDING`
  (422) and `CANNOT_DENY_SELF` (422), with links. The last two are admin codes, documented in
  `modules/auth.md`.
- **"Source files" table**: add `core/jwt.guard.ts` (session lookup) and
  `auth/user-approval.config.ts`, if they are not already there.

## Files to Change
- `docs/agents/backend/routes/auth.md` — per-endpoint status rules, error codes, session-revoke caveat, cookie-clearing exception, source files
- `docs/agents/modules/auth.md` — only if recover / reset contracts live there instead
