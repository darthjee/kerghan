# Add AccountsClient.updateAccount

Add a new method to `AccountsClient.js`, mirroring the shape of
`authorizeAuthorizationRequest` (`AccountsClient.js:190-195`) but calling the new endpoint via the
`patchJson` helper added in step 01:

```js
updateAccount({ currentPassword, username, email, newPassword }) {
  return this.apiClient.patchJson('/auth/account.json', {
    currentPassword,
    ...(username !== undefined && { username }),
    ...(email !== undefined && { email }),
    ...(newPassword !== undefined && { newPassword }),
  });
}
```
(Adjust to match this file's existing style for building the body — the key constraint is: never
include a `newPasswordConfirmation` field in the request, per [plan.md](../plan.md)'s shared
contract.)

## Files to Change
- `frontend/assets/js/client/AccountsClient.js` — add `updateAccount`, calling
  `PATCH /auth/account.json` via `patchJson`.
