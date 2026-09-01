# Recover page

Add the email-request page: `Recover.jsx` + `RecoverController.js` + `RecoverHelper.jsx`,
following `Login.jsx`'s exact three-file shape, but with the enumeration-safety contract carried
into the UI: **always** show the same confirmation, no matter what happens.

`RecoverController`:

```js
export default class RecoverController {
  constructor(setSent, client = AccountsClient) {
    this.setSent = setSent;
    this.client = client;
  }

  async handleSubmit(email) {
    try {
      await this.client.recover(email);
    } finally {
      this.setSent(true);
    }
  }
}
```

The `finally` block is the whole point: a thrown `ApiError`/network failure and a real `{ sent:
true }` response are treated identically, mirroring the reference material's
`LoginModalController` precedent — a real outage looks the same as success to the end user, by
design (this is the enumeration-safety contract, carried into the UI layer, not just the API).

`Recover.jsx` mirrors `Login.jsx`'s state/hook shape (a single `email` field, plus a boolean
`sent` state instead of `submitError`) and delegates rendering to `RecoverHelper`, which renders
either the email form or, once `sent` is `true`, a static "check your email" confirmation
message — no field errors, no submit-error alert (there is nothing to display; see
`RecoverController` above).

## Files to Change

- `frontend/assets/js/components/resources/accounts/pages/Recover.jsx` — new page component.
- `frontend/assets/js/components/resources/accounts/pages/controllers/RecoverController.js` —
  new controller, as above.
- `frontend/assets/js/components/resources/accounts/pages/helpers/RecoverHelper.jsx` — new
  helper: email form (mirroring `LoginHelper`'s single-field shape) or confirmation message.
- `frontend/specs/assets/js/components/resources/accounts/pages/RecoverSpec.js` — new spec,
  mirroring `LoginSpec.js`'s shape.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/RecoverControllerSpec.js`
  — new spec: asserts `setSent(true)` is called both when `client.recover` resolves and when it
  rejects (the enumeration-safety behavior is the one thing worth testing explicitly here).
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/RecoverHelperSpec.js` —
  new spec, mirroring `LoginHelperSpec.js`'s shape for the two render states.
