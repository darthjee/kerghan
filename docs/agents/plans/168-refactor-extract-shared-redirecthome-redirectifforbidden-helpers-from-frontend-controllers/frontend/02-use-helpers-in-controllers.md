# Use helpers in the five controllers
Import from `utils/routing/redirects.js` (relative path per file) and delete each private `#redirectHome()` / `#redirectIfForbidden()` copy:

- `AdminUsersController.js` and `AdminUserEditController.js` — delete both private methods; call `redirectIfForbidden(error)` from the existing `if (this.#redirectIfForbidden(error))` sites.
- `RegisterController.js`, `LoginModalController.js`, `HeaderController.js` — delete the private `#redirectHome()`; call the imported `redirectHome()` at the existing call sites.

Update any class-level/JSDoc comment that describes the removed private methods (e.g. the `LoginModalController` comment referencing `LoginController#redirectHome`). Existing controller specs must pass unchanged.

## Files to Change
- `frontend/assets/js/components/resources/admin/pages/controllers/AdminUsersController.js` — use `redirectIfForbidden`, drop both private methods
- `frontend/assets/js/components/resources/admin/pages/controllers/AdminUserEditController.js` — use `redirectIfForbidden`, drop both private methods
- `frontend/assets/js/components/resources/accounts/pages/controllers/RegisterController.js` — use `redirectHome`, drop private method
- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js` — use `redirectHome`, drop private method
- `frontend/assets/js/components/common/header/controllers/HeaderController.js` — use `redirectHome`, drop private method
