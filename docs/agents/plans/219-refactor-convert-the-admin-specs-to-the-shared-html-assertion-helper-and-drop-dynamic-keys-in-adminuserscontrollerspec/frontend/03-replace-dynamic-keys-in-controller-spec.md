# Replace dynamic keys in AdminUsersControllerSpec
Change `itRedirectsHomeOn403` so no bracket access with a variable key remains. Replace `{ title, method, args, clientMethod, assertUntouched }` with `{ title, stub, act, assertUntouched }`:

- `stub(client)` returns the client spy to reject, for example `(c) => c.searchUsers`. The example calls `stub(client).and.rejectWith(new ApiError(403, 'Forbidden'))`.
- `act(controller)` performs the call, for example `(controller) => controller.handleSearch('foo')`. The example does `await act(controller)`.

Update all three call sites:
- `#handleSearch`: `stub: (c) => c.searchUsers`, `act: (controller) => controller.handleSearch('foo')`
- `#handleGenerateLink`: `stub: (c) => c.generateRecoveryLink`, `act: (controller) => controller.handleGenerateLink(1)`
- `#handleSendEmail`: `stub: (c) => c.sendRecoveryEmail`, `act: (controller) => controller.handleSendEmail(1)`

`client` and `controller` are passed in as arguments rather than closed over, because `client` is reassigned in `beforeEach`.

## Files to Change
- `frontend/specs/assets/js/components/resources/admin/pages/controllers/AdminUsersControllerSpec.js` — change the `itRedirectsHomeOn403` signature and its three call sites.
