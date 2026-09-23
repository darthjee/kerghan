# Page: Map initial state and delegate patches to the controller
In `AuthorizationRequests.jsx`:
- `const INITIAL_ROW_STATE = new Map();`
- Delete the local `patchRow`.
- `handleToggleAuthorize` calls `controller.patchRow(uuid, { open: !(rowState.get(uuid)?.open ?? false) })`.
- `handlePasswordChange` calls `controller.patchRow(uuid, { password: event.target.value })`.
- `handleConfirmAuthorize` reads the password with `rowState.get(uuid)?.password ?? ''`.

In `AuthorizationRequestsSpec.js`:
- The default-state expectation becomes `rowState: new Map()`.
- Rewrite the two "locally, without reaching the controller" specs, because both handlers now delegate. Spy on `AuthorizationRequestsController.prototype.patchRow` and assert it is called with `('req-uuid', { open: true })` and `('req-uuid', { password: 'secret' })`. Keep the assertions that `authorize`/`deny` are not called.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/AuthorizationRequests.jsx` — Map initial state, `.get()` reads, handlers delegate to `controller.patchRow`.
- `frontend/specs/assets/js/components/resources/accounts/pages/AuthorizationRequestsSpec.js` — Map default state and `patchRow` delegation expectations.
