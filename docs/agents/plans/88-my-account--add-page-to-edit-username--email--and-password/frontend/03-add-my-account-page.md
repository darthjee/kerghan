# Add MyAccount page/controller/helper

Create the new page mirroring the existing `AuthorizationRequests*` triplet under
`frontend/assets/js/components/resources/accounts/pages/`:
- `pages/AuthorizationRequests.jsx` → `pages/MyAccount.jsx`
- `pages/controllers/AuthorizationRequestsController.js` → `pages/controllers/MyAccountController.js`
- `pages/helpers/AuthorizationRequestsHelper.jsx` → `pages/helpers/MyAccountHelper.jsx`

No CSS module exists for the sibling page set — don't add one here either.

**Controller** (`MyAccountController.js`): loads the current `username`/`email` on mount (there is
no existing "get my account" read endpoint — reuse whatever the page already has access to, or
note this as a follow-up if no such data is currently available client-side), holds form state for
`username`, `email`, `currentPassword`, `newPassword`, `newPasswordConfirmation`, validates
`newPassword === newPasswordConfirmation` client-side before submit (never sending the
confirmation field), calls `AccountsClient.updateAccount` (step 02) on submit, and on success
updates its own local `username`/`email` state from the response — no token refresh, no
re-login, no navigation away.

**Helper** (`MyAccountHelper.jsx`): renders editable `username`/`email` fields, a "current
password" field required for any save, a separate "change password" section (new password +
confirmation), a save action, and inline error display for each failure case: wrong current
password, duplicate username, duplicate email, password too short, passwords not matching
(client-side), and a success confirmation.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/MyAccount.jsx` — new page component.
- `frontend/assets/js/components/resources/accounts/pages/controllers/MyAccountController.js` —
  new controller (state, validation, submit handling).
- `frontend/assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx` — new
  presentational helper (form fields, inline errors).
