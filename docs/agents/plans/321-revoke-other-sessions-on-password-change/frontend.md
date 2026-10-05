# Frontend Plan: Revoke other sessions on password change

Main plan: [plan.md](plan.md)

## Shared contracts

- `PATCH /auth/account.json` now accepts an optional `refreshToken: string` in the body. Send
  the stored token (`AuthSession.get()`) when one exists. Omit it when `AuthSession.get()`
  returns `null`, because `pickDefined` only drops `undefined`. The response is unchanged.
- The admin edit request is unchanged; the backend revokes all of the target's tokens on a
  password edit.

## Implementation Steps

### Step 1 — Send the current refresh token with the account update
In `AccountsClient.updateAccount`, add
`refreshToken: AuthSession.get() ?? undefined` to the `pickDefined({...})` call, so the
current session is identified on every account update. The backend ignores it for non-password
changes. Update the method's doc-comment, which currently says it "never touches
`AuthSession`": it now reads the token but still never writes or clears it. Do not change the
`MyAccountController` payload shape; the client attaches the token, matching how
`ApiClient`'s refresh path reads `AuthSession` itself.

Jasmine (`specs/assets/js/client/AccountsClientSpec.js`):
- The PATCH body includes `refreshToken` when a token is stored.
- The PATCH body omits `refreshToken` when no token is stored.

### Step 2 — Render the password hints
Add an optional `passwordHint` string to `AccountEditFormHelper.render`'s `options`. When it is
present, render it directly under the "Change password" heading as muted help text (for
example `<p className="form-text">`). Pass it from both pages:
- `MyAccountHelper`: "Changing the password signs out your other sessions."
- `AdminUserEditHelper`: "Changing the password signs the user out of all sessions."

Update the `options` JSDoc.

Jasmine:
- `AccountEditFormHelperSpec`: the hint renders when given and is absent otherwise.
- `MyAccountHelperSpec` / `MyAccountSpec`: the My Account hint renders.
- `AdminUserEditHelperSpec` / `AdminUserEditSpec`: the admin hint renders.

## Files to Change
- `frontend/assets/js/client/AccountsClient.js` — send `refreshToken` with `updateAccount`; doc-comment.
- `frontend/assets/js/components/common/forms/helpers/AccountEditFormHelper.jsx` — optional `passwordHint` option.
- `frontend/assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx` — pass the My Account hint.
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx` — pass the admin hint.
- `frontend/specs/assets/js/client/AccountsClientSpec.js` — request-body specs.
- `frontend/specs/assets/js/components/common/forms/helpers/AccountEditFormHelperSpec.js` — hint specs.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/MyAccountHelperSpec.js` — hint spec.
- `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelperSpec.js` — hint spec.

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- After a My Account password change, the user stays signed in on this device (their token is
  kept). No client-side session handling changes are needed.
- If an admin changes their own password through the admin page, their own session is revoked
  too. The next token refresh fails and the existing 401 handling signs them out. This is
  accepted behavior per the issue.
