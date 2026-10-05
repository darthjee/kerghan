# Hold and submit the flag in the login modal

- Add `keepSignedIn: false` to `INITIAL_FIELDS` in both `LoginModal.jsx` and
  `LoginModalController.js`. `switchMode` then resets it on every tab change, and a reopened modal
  starts unchecked.
- In `LoginModal.jsx`, add an `onKeepSignedInChange` handler that reads `event.target.checked`
  (not `value`) into `fields.keepSignedIn`, and pass it in the handlers object given to
  `LoginModalHelper.render`. Make sure `LoginModalHelper` forwards it to `LoginModalFormsHelper`.
- `LoginModalController#submitPassword` already passes `fields` to `client.login`, so confirm that
  `keepSignedIn` flows through. `#submitDevice` destructures `{ username, keepSignedIn }` and calls
  `client.createAuthorizationRequest(username, keepSignedIn)`.
- `#submitRegister` must not send the flag. `register` already picks only its own fields, so
  confirm this and cover it with a spec.
- Specs: `switchMode` resets `keepSignedIn` to `false`; password submit calls `login` with
  `keepSignedIn` set; device submit calls `createAuthorizationRequest(username, true)` when it is
  checked; the modal's change handler sets the field from `checked`.

## Files to Change

- `frontend/assets/js/components/common/loginModal/LoginModal.jsx` — initial field, checkbox handler.
- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js` — initial
  field, device submit passes the flag.
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalHelper.jsx` — forward the new
  handler (and update its JSDoc) if it doesn't already pass the handlers through.
- `frontend/specs/assets/js/components/common/loginModal/LoginModalSpec.js`
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerSpec.js`
