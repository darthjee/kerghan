# Frontend Plan: Header and page need to react to login and logoff

Main plan: [plan.md](plan.md)

## Shared contracts

Consumes `POST /auth/status.json` exactly as specified in [plan.md](plan.md)'s "Shared
contracts" section, via a new `AccountsClient.status(refreshToken)` method: sends
`{ refreshToken }`, expects back `{ loggedIn: boolean }`. Skip the call entirely (no
network request) when `AuthSession.get()` has no stored token — go straight to
"logged out" in that case.

## Steps

- [01 — Add the AuthEvents module](frontend/01-add-auth-events.md)
- [02 — Add AccountsClient.status() and HeaderController.checkStatus()](frontend/02-add-status-check.md)
- [03 — Make Header stateful via a useAuthEffect hook](frontend/03-make-header-stateful.md)
- [04 — Fix Register/add Recover in HeaderHelper](frontend/04-fix-header-links.md)
- [05 — Emit on successful login](frontend/05-emit-on-login.md)

## CI Checks

- `frontend`: `npm run coverage` (CI job: `jasmine`)
- `frontend`: `npm run lint` (CI job: `frontend-checks`)

## Notes

- Cross-tab sync is explicitly out of scope (per the issue) — `AuthEvents` only needs to
  fire within the tab that dispatched it.
- The actual password-recovery feature (backend + frontend) is out of scope, tracked in
  #36 — step 04 here only adds a placeholder link.
