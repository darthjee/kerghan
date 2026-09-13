# Add frontend specs

Add Jasmine specs mirroring the existing `AuthorizationRequests*` spec set:
- `frontend/specs/.../pages/AuthorizationRequestsSpec.js` → `MyAccountSpec.js`
- `frontend/specs/.../pages/controllers/AuthorizationRequestsControllerSpec.js` →
  `MyAccountControllerSpec.js`
- `frontend/specs/.../pages/helpers/AuthorizationRequestsHelperSpec.js` →
  `MyAccountHelperSpec.js`
- `frontend/specs/assets/js/client/AccountsClientAuthorizationRequestsSpec.js` — add cases for
  `AccountsClient.updateAccount` (or a new sibling spec file if that's this project's convention
  for grouping client specs by feature).

Cover: successful save (username/email/password, individually and combined), wrong current
password (inline error, no state mutation), duplicate username/email (inline error), password too
short, new-password/confirmation mismatch (client-side only, no request sent), and that a
successful response updates the page's displayed `username`/`email` without any navigation or
re-login.

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/MyAccountSpec.js` — new page spec.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/MyAccountControllerSpec.js` —
  new controller spec (validation, submit, success/error state).
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/MyAccountHelperSpec.js` —
  new helper spec (rendering, inline errors).
- `frontend/specs/assets/js/client/AccountsClientAuthorizationRequestsSpec.js` (or a new sibling
  file) — add/extend coverage for `AccountsClient.updateAccount`.
