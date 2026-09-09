# ResetPasswordLanding + delete the Recover page trio

Turn `ResetPassword.jsx` into a redirect-only landing, slim `ResetPasswordController` to the
one method the modal reuses, and delete the `Recover.jsx` page trio.

## What to do

### `git mv` `ResetPassword.jsx` → `ResetPasswordLanding.jsx`

`git mv frontend/assets/js/components/resources/accounts/pages/ResetPassword.jsx frontend/assets/js/components/resources/accounts/pages/ResetPasswordLanding.jsx`,
then rewrite it to a mount-time redirect, mirroring `components/common/ModalRedirect.jsx`'s
extracted-function shape:

```js
import { useEffect } from 'react';
import LoginModalEvents from '../../../../client/LoginModalEvents.js';

/** SSR/spec-safe `token` query-param parse from the current hash. */
function getTokenFromHash(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  const queryString = hash.split('?')[1] || '';
  return new URLSearchParams(queryString).get('token');
}

/** Open the modal in resetPassword mode with the hash's token, then return the URL to `#/`. */
export function redirectToResetModal() {
  LoginModalEvents.open('resetPassword', { token: getTokenFromHash() });

  if (typeof window !== 'undefined') {
    window.location.hash = '/';
  }
}

/** Landing for `#/recover-password?token=…`: opens the modal and redirects home. Renders nothing. */
export default function ResetPasswordLanding() {
  useEffect(() => redirectToResetModal(), []);

  return null;
}
```

- Keep `getTokenFromHash` private (not exported) — it moves here from the old
  `ResetPassword.jsx`; it is **not** in `ResetPasswordController`.
- Import path from `pages/` to `client/` is `../../../../client/LoginModalEvents.js` (four
  levels). Full JSDoc (`@param` / `@returns` / `@description`) on all three.

### Slim `controllers/ResetPasswordController.js`

Nothing calls `handleSubmit` / `setResetDone` once the page is gone. Reduce it to `validate()`
plus `#validatePassword` / `#validatePasswordConfirmation`; remove the constructor,
`handleSubmit`, and the `import AccountsClient` line. Keep `validate()` an instance method
(consistent with `RegisterController`), so `LoginModalController` reuses it via
`new ResetPasswordController()`. Update the class JSDoc.

### Delete the Recover page trio

- `frontend/assets/js/components/resources/accounts/pages/Recover.jsx`
- `frontend/assets/js/components/resources/accounts/pages/helpers/RecoverHelper.jsx`
- `frontend/assets/js/components/resources/accounts/pages/controllers/RecoverController.js`
- `frontend/assets/js/components/resources/accounts/pages/helpers/ResetPasswordHelper.jsx`
  (the landing renders nothing, so no view helper)

(Spec deletions are in step 06.)

## Files to Change

- `frontend/assets/js/components/resources/accounts/pages/ResetPassword.jsx` → **rename** to
  `ResetPasswordLanding.jsx` and rewrite as the redirect-only landing above.
- `frontend/assets/js/components/resources/accounts/pages/controllers/ResetPasswordController.js`
  — reduce to `validate()` + its private helpers; drop the constructor, `handleSubmit`, and
  the `AccountsClient` import.
- `frontend/assets/js/components/resources/accounts/pages/Recover.jsx` — **delete**.
- `frontend/assets/js/components/resources/accounts/pages/helpers/RecoverHelper.jsx` —
  **delete**.
- `frontend/assets/js/components/resources/accounts/pages/controllers/RecoverController.js` —
  **delete**.
- `frontend/assets/js/components/resources/accounts/pages/helpers/ResetPasswordHelper.jsx` —
  **delete**.
