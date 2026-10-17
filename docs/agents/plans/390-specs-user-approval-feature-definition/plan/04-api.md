# api.md

Define every changed and new endpoint in `docs/agents/specs/user-approval/api.md`, in Kerghan's
conventions (error body `{ error: { code, message, details? }, statusCode, timestamp }`,
specific codes as new `ErrorCodes` entries, `@CachePolicy`).

**User endpoints (#392):**

- `POST /auth/register.json`: status from the flag; response and cookies unchanged.
- `POST /auth/login.json`: wrong credentials keep the existing `401`; `denied` →
  `403 USER_DENIED` only after the password is verified; `pending` → normal session.
- `POST /auth/status.json`: the table from #390 (approved unchanged; pending →
  `{ loggedIn: false, isAdmin: false, status: "pending" }` with cookies kept; denied with an
  active session → byte-for-byte unauthenticated, cookies cleared; no valid session → existing
  flow incl. automatic login). `status` appears only for pending; automatic-login precedence
  unchanged.
- `POST /auth/refresh.json`: keeps rotating a pending user's session.
- `POST /auth/recover.json` / `reset-password.json`: recover identical for every status; reset
  rejects a denied user's token with the generic invalid-token error; pending may reset and
  stays pending.
- Device authorization: `authorize.json` needs no change (the gate answers `401` first; it keeps
  reporting business rejections as `400`); `poll.json` re-checks the status and never mints a
  session for a non-approved user.

**Admin endpoints (#393)** — `@AdminOnly()`, `@CachePolicy(CacheClass.Never)`, thin controller,
available whatever the flag:

- `POST /admin/users/search.json`: optional `status` filter (`@IsIn`, invalid →
  `400 VALIDATION_FAILED`), combinable with `q`; each item gains `status`; still unpaginated.
- `POST /admin/users/:id/approve.json`: `404 NOT_FOUND`; `422 USER_NOT_PENDING`;
  `200 { user }`; sessions untouched.
- `POST /admin/users/:id/deny.json`: `404 NOT_FOUND`; `409 DEFAULT_USER_MANAGED`;
  `422 CANNOT_DENY_SELF`; `200 { user }` from any status; revokes every refresh token with
  `RevokedReason.ADMIN_DENIED = 'admin_denied'` (never triggers replay detection).
- User item shape: existing fields plus `status`; never the password digest or tokens.

**Required tests:** one per row above, plus the cache policy of each changed or new route and a
note for the cache agent to check the Navi resources.

## Files to Change
- `docs/agents/specs/user-approval/api.md` — new: user and admin endpoint contracts, error codes,
  revoked reason, cache policy, required tests.
