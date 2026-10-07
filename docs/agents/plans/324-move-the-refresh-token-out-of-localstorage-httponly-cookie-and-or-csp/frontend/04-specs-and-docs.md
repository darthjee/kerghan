# Specs and docs

- Rewrite `AuthSessionSpec.js` for the hint cookie and `takeLegacyToken` (returns the value once, then `null`; removes the key).
- Update `AccountsClientSpec.js`, `AccountsClientSessionsSpec.js`, `AccountsClientAuthorizationRequestsSpec.js`, `ApiClientSpec.js` and the Header/HeaderController specs:
  - no `refreshToken` in bodies, nothing persisted;
  - `401` → tokenless refresh when logged in, straight to session-expired otherwise;
  - `migrateLegacyToken` sends the body token and tolerates failure;
  - the Header runs the migration once, then the status check.
- Update `docs/agents/architecture/frontend.md` (auth state section: hint cookie, no token in JS, migration TODO).

## Files to Change
- `frontend/specs/assets/js/client/AuthSessionSpec.js`, `AccountsClientSpec.js`, `AccountsClientSessionsSpec.js`, `AccountsClientAuthorizationRequestsSpec.js`, `ApiClientSpec.js`
- `frontend/specs/assets/js/components/common/header/**` — Header and HeaderController specs
- `docs/agents/architecture/frontend.md` — documentation
