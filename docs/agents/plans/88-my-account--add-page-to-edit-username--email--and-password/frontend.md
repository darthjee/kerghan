# frontend Plan: My Account: add page to edit username, email, and password

Main plan: [plan.md](plan.md)

## Shared contracts

Frontend calls `PATCH /auth/account.json` exactly as specified in [plan.md](plan.md)'s "Shared
contracts" section: sends `{currentPassword, username?, email?, newPassword?}` (never a
confirmation field), and on success reads `{username, email}` back to update the page's own
displayed state — no token refresh or re-login is triggered.

## Steps

- [01 — Add patchJson to ApiClient](frontend/01-add-patch-json-to-api-client.md)
- [02 — Add AccountsClient.updateAccount](frontend/02-add-accounts-client-update-account.md)
- [03 — Add MyAccount page/controller/helper](frontend/03-add-my-account-page.md)
- [04 — Register the new route](frontend/04-register-route.md)
- [05 — Add dropdown item](frontend/05-add-dropdown-item.md)
- [06 — Add frontend specs](frontend/06-add-frontend-specs.md)

## CI Checks

- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- No CSS module exists for the sibling `AuthorizationRequests*` page set — don't add one for
  `MyAccount` either unless the design genuinely needs it.
- The new-password confirmation field is client-side only (equality check before submit); it must
  never be included in the PATCH body sent to the backend.
