# Route contracts in backend/routes/auth.md

Fold the wire contracts, following the file's existing per-endpoint style:

- **`POST /auth/status.json`**: the automatic-login behavior from
  `automatic-login.md` → "Response contract": when it applies (no valid session, feature on,
  allowed IP), the response body, the cookies (same as `login.json`), session lifetime, a
  disallowed IP or the feature turned off (unchanged response), caching (`X-Skip-Cache` and cache
  policy unchanged or as implemented), session metadata.
- **`PATCH /auth/account.json`**, and the password recovery and reset endpoints if documented
  here: the `409` response for managed fields of the default user, with the body shape from
  `edit-blocking.md` → "Response".
- Link to `../modules/auth/default-user.md` for the rules and rationale.

Check the response shapes against `backend/src/auth/` (controller, `default-user.service.ts`) and
the e2e specs.

## Files to Change
- `docs/agents/backend/routes/auth.md` — automatic login on `status.json`, `409` on blocked edits.
