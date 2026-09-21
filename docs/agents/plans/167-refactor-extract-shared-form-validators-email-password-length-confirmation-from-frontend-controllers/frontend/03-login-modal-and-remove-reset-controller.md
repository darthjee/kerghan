# Use validators in LoginModalController and remove ResetPasswordController
`LoginModalController` currently imports `RegisterController` and `ResetPasswordController` and keeps two module-level shared instances (plus the `noop` helper) only to call their pure `validate()`.

- Replace those imports/instances (and the now-unused `noop`, if nothing else uses it) with `import { validateRegistration, validateResetPassword } from '../../../../utils/validation/formValidators.js'`; `#submitRegister` calls `validateRegistration(fields)` and `#submitResetPassword` calls `validateResetPassword(fields)`. Update the class JSDoc that currently says "validates with {@link RegisterController}'s rules" / "{@link ResetPasswordController}'s rules".
- Delete `ResetPasswordController.js` (its only consumer was the modal) and `ResetPasswordControllerSpec.js`; its cases are covered by `formValidatorsSpec.js` from step 01.
- Existing `LoginModalControllerSpec` must pass unchanged.

## Files to Change
- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js` — call the validators directly, drop controller imports/shared instances
- `frontend/assets/js/components/resources/accounts/pages/controllers/ResetPasswordController.js` — delete
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/ResetPasswordControllerSpec.js` — delete
