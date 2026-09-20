# Add pickDefined helper and use it in the clients
`AccountsClient.updateAccount` and `AdminClient.editUser` each spread `...(x !== undefined && { x })` for `username`, `email`, `newPassword`. Add a small helper `pickDefined(object)` that returns a new object containing only the keys whose value is not `undefined` (keep `null`/`''`/`0`/`false` — same semantics as today), then use it in both clients. `updateAccount` keeps `currentPassword` always present (`{ currentPassword, ...pickDefined({ username, email, newPassword }) }`); `editUser` becomes `pickDefined({ username, email, newPassword })`. Request bodies must be byte-for-byte identical to today's.

## Files to Change
- `frontend/assets/js/client/pickDefined.js` — new helper with JSDoc (default export, matching the repo's one-thing-per-file style)
- `frontend/assets/js/client/AccountsClient.js` — `updateAccount` uses `pickDefined`
- `frontend/assets/js/client/AdminClient.js` — `editUser` uses `pickDefined`
- `frontend/specs/assets/js/client/pickDefinedSpec.js` — new spec: omits `undefined`, keeps `''`/`null`/`0`/`false`, returns `{}` for all-undefined
