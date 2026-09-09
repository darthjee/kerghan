# Specs: add, update, delete

Jasmine + c8, driven through `specs/support/jsx-loader.mjs`. Follow existing spec style:
`renderToStaticMarkup` for helper markup, `jasmine.createSpy` / `createSpyObj` for setters and
clients, `globalThis.window` save/restore for hash-based tests (see `ModalRedirectSpec.js`).

## Update

### `.../loginModal/controllers/LoginModalControllerSpec.js`

- `client = jasmine.createSpyObj('client', ['login', 'register', 'recover', 'resetPassword'])`.
- Add a `setResultPanel` spy and pass it into the `build()` helper's constructor call in the
  new position (before `client`).
- `#switchMode`: also asserts `setResultPanel` called with `null`.
- `handleSubmit('recover', …)`: calls `client.recover(fields.email)`, then `setResultPanel`
  with `'recover'` — **also** when `client.recover` rejects (await the returned promise).
  Never calls `AuthEvents.emit` / `LoginModalEvents.close`.
- `handleSubmit('resetPassword', fields, token)`: invalid fields → `setFieldErrors` with a
  non-empty map and `client.resetPassword` not called; valid → `client.resetPassword`
  called with `{ token, password, passwordConfirmation }`, then `setResultPanel('resetPassword')`,
  and no `AuthEvents.emit` / `LoginModalEvents.close` / hash change; rejection →
  `setSubmitError` with the error message.

### `.../loginModal/hooks/useLoginModalSpec.js`

- Effect built with `{ setOpen, setResetToken, setResultPanel }` spies.
- On an `open` event whose `detail` carries `token`: `setResetToken` called with that token,
  `setResultPanel` called with `null`, `controller.switchMode` called with `detail.mode`.
- On an `open` event with no token: `setResetToken` called with `''`.

### `.../loginModal/helpers/LoginModalFormsHelperSpec.js`

- Mode selector now renders a `Recover` button alongside `Password` / `Register`.
- `state.mode === 'recover'` renders a single email field; `'resetPassword'` renders the two
  password fields; an unknown mode still falls back to the password field set.
- `state.resultPanel === 'recover'` renders the neutral "reset link is on its way" text and no
  `<form>` / mode selector.
- `state.resultPanel === 'resetPassword'` renders the "password has been updated" text plus a
  "Back to log in" button whose `onClick` calls `handlers.onSelectMode` with `'password'`.

### `.../loginModal/helpers/LoginModalHelperSpec.js`

- Title is `Recover password` for `recover` and `Set a new password` for `resetPassword`.

### `.../loginModal/LoginModalSpec.js`

- If it asserts the render-state shape or the `onSubmit` / `onSelectMode` wiring, extend it:
  `onSubmit` now forwards the token as the third `handleSubmit` arg; `onSelectMode` clears the
  panel + token before `switchMode`; the render state includes `resultPanel`.

### `.../components/helpers/AppHelperSpec.js`

- `render('reset-password')` renders `ResetPasswordLanding` (renders nothing visible).
- `render('recover')` falls back to `Home` (no `recover` key).

### `.../utils/routing/HashRouteResolverSpec.js`

- `#/recover` now resolves to `home` (mirror the existing `#/login` / `#/register` fallback
  assertions added in #62).
- `#/recover-password` still resolves to `reset-password`.

### `.../common/header/helpers/HeaderHelperSpec.js`

- The Recover link is now an `href="#"` link whose `onClick` `preventDefault`s and calls
  `onOpenLogin('recover')` — no longer `href="#/recover"`.

### `.../accounts/pages/controllers/ResetPasswordControllerSpec.js`

- Drop the `handleSubmit` describe block and the setter/`client` spies; keep only the
  `validate()` cases, constructing with `new ResetPasswordController()`.

## Add

### `.../accounts/pages/ResetPasswordLandingSpec.js` (new)

Model on `ModalRedirectSpec.js`:
- `redirectToResetModal` with `globalThis.window.location.hash` stubbed to
  `'#/recover-password?token=abc'` → `LoginModalEvents.open` called with
  `('resetPassword', { token: 'abc' })`, and `window.location.hash` set to `'/'`.
- Hash with no `token` query param → `open` called with `{ token: null }`.
- The component renders nothing (`renderToStaticMarkup` → `<div></div>`).

## Delete

- `frontend/specs/assets/js/components/resources/accounts/pages/RecoverSpec.js`
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/RecoverHelperSpec.js`
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/RecoverControllerSpec.js`
- `frontend/specs/assets/js/components/resources/accounts/pages/ResetPasswordSpec.js`
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/ResetPasswordHelperSpec.js`

## Files to Change

- Update: `LoginModalControllerSpec.js`, `useLoginModalSpec.js`, `LoginModalFormsHelperSpec.js`,
  `LoginModalHelperSpec.js`, `LoginModalSpec.js`, `AppHelperSpec.js`, `HashRouteResolverSpec.js`,
  `HeaderHelperSpec.js`, `controllers/ResetPasswordControllerSpec.js` (paths under
  `frontend/specs/assets/js/...`).
- Add: `frontend/specs/assets/js/components/resources/accounts/pages/ResetPasswordLandingSpec.js`.
- Delete: `RecoverSpec.js`, `helpers/RecoverHelperSpec.js`, `controllers/RecoverControllerSpec.js`,
  `ResetPasswordSpec.js`, `helpers/ResetPasswordHelperSpec.js` (paths under
  `frontend/specs/assets/js/components/resources/accounts/pages/`).
