# Delete the standalone Login/Register pages

Once steps 01–06 are in place and passing (the modal fully replaces the old pages'
functionality), delete the old full-page implementations and their specs. Keep
`RegisterController.js` (or whatever it was reduced to for `validate()` reuse in step 02) — it's
still used by the modal.

## Files to Change

- `frontend/assets/js/components/resources/accounts/pages/Login.jsx` — delete.
- `frontend/assets/js/components/resources/accounts/pages/helpers/LoginHelper.jsx` — delete.
- `frontend/assets/js/components/resources/accounts/pages/controllers/LoginController.js` —
  delete.
- `frontend/assets/js/components/resources/accounts/pages/Register.jsx` — delete.
- `frontend/assets/js/components/resources/accounts/pages/helpers/RegisterHelper.jsx` — delete.
- `frontend/specs/assets/js/components/resources/accounts/pages/LoginSpec.js` — delete.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/LoginHelperSpec.js` —
  delete.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/LoginControllerSpec.js`
  — delete.
- `frontend/specs/assets/js/components/resources/accounts/pages/RegisterSpec.js` — delete.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/RegisterHelperSpec.js` —
  delete.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/RegisterControllerSpec.js`
  — keep, adjusted only if `validate()` was extracted/relocated in step 02.
