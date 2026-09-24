# Convert AdminClient and AccountsClient to object modules
Rewrite both files as `const X = { async method(...) {...}, ... }; export default X;`:

- `AdminClient`: `searchUsers`, `generateRecoveryLink`, `sendRecoveryEmail`, `editUser`.
- `AccountsClient`: `register`, `login`, `refresh`, `logout`, `status`, `recover`,
  `resetPassword`, `createAuthorizationRequest`, `pollAuthorizationRequest`,
  `listAuthorizationRequests`, `authorizeAuthorizationRequest`, `denyAuthorizationRequest`,
  `updateAccount`.

Method bodies stay identical (drop only the `static` keyword); keep calling `ApiClient.xxx(...)`
and `AuthSession.xxx(...)` through their exported objects. Remove the
`eslint-disable-next-line @typescript-eslint/no-extraneous-class` comment blocks and move the
class-level JSDoc onto the object. `{@link AccountsClient.login}`-style references remain valid.

Run the existing specs unchanged to confirm spies on `ApiClient` / `AdminClient` /
`AccountsClient` still intercept.

## Files to Change
- `frontend/assets/js/client/AdminClient.js` — class → object module.
- `frontend/assets/js/client/AccountsClient.js` — class → object module.
