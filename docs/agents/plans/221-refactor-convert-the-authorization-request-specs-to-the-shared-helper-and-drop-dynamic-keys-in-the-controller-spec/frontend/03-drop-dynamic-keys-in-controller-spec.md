# Drop dynamic keys in AuthorizationRequestsControllerSpec
Remove the 6 `security/detect-object-injection` findings in `itBehavesLikeRowAction`, where `client[clientMethod]` and `controller[method](...args)` are used. Follow the `stub` / `act` pattern from `AdminUsersControllerSpec` (#219).

- Change the shared example's params from `method, clientMethod` to `stub, act`, keeping `args`, `successResponse`, `errorArgs`, `errorMessage`, `rowStateBefore` and `rowStateAfter`.
- Inside the three cases:
  - `client[clientMethod]` → `stub(client)` (for `.and.resolveTo`, `.and.rejectWith` and the `toHaveBeenCalledWith(...args)` assertion).
  - `controller[method](...args)` → `act(controller, ...args)`, and `controller[method](...errorArgs)` → `act(controller, ...errorArgs)`. `act` takes the args because the success and 400 cases pass different lists.
- Callers:
  - `#authorize`: `stub: (c) => c.authorizeAuthorizationRequest`, `act: (controller, ...args) => controller.authorize(...args)`.
  - `#deny`: `stub: (c) => c.denyAuthorizationRequest`, `act: (controller, ...args) => controller.deny(...args)`.
- Keep the success, 400 and expired-session cases for both.

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsControllerSpec.js`: replace the string keys with `stub` / `act` functions.
