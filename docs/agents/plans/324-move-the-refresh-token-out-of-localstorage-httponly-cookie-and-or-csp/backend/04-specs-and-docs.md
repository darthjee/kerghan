# Specs and docs

- Update the unit and e2e specs for every changed route:
  - session-minting responses set `access_token`, `refresh_token` (`Path=/auth`, HttpOnly, Secure, SameSite=Strict, Max-Age matching the regular/persistent TTL) and `logged_in=1` (not HttpOnly, `Path=/`), and their bodies no longer contain `refreshToken`;
  - `refresh`/`logoff`/`status`/`sessions/*`/`account` work from the cookie;
  - the migration fallback works on `refresh` with a body token and no cookie, and the cookie wins when both are present;
  - the cookies are cleared on logoff, on a failed refresh and on `status → loggedIn: false`;
  - a missing cookie behaves as described in the shared contract.
- Fix the test support helpers that assume a single `Set-Cookie` header (`tests/support/auth-requests.ts#loginCookie` takes `set-cookie[0]`). Pick cookies by name, and add a helper that returns the `refresh_token` cookie for replay.
- Docs: update `docs/agents/backend/routes/auth.md`, `docs/agents/modules/auth.md`, `docs/agents/architecture/backend.md` and `docs/agents/architecture/security.md` (cookie table, removed body fields, migration fallback with its removal TODO), plus any `refreshToken`-in-body mention in `docs/agents/flow.md` and `docs/agents/product.md`.

## Files to Change
- `backend/src/auth/tests/*.spec.ts`, `backend/src/auth/tests/*.e2e-spec.ts` — the cases above
- `backend/src/auth/tests/support/auth-requests.ts` — pick cookies by name
- `docs/agents/backend/routes/auth.md`, `docs/agents/modules/auth.md`, `docs/agents/architecture/backend.md`, `docs/agents/architecture/security.md`, `docs/agents/flow.md`, `docs/agents/product.md` — documentation
