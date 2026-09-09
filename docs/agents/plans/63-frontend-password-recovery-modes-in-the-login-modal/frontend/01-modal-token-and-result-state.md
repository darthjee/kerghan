# Token + result-panel state in the modal shell

The modal needs two new pieces of state that the #62 shell does not have: the reset token
carried in on `LoginModalEvents.open('resetPassword', { token })`, and a `resultPanel` flag
that keeps the modal open showing a neutral / success panel instead of a form. `LoginModal.jsx`
owns both; `useLoginModal.js` feeds the token in from the bus and clears the panel on every
open.

## What to do

### `components/common/loginModal/LoginModal.jsx`

- Add `const [resetToken, setResetToken] = useState('')` and
  `const [resultPanel, setResultPanel] = useState(null)` (`resultPanel` holds `'recover'`,
  `'resetPassword'`, or `null`).
- Pass `setResultPanel` into the memoized controller as a new constructor arg (before
  `client`): `new LoginModalController(setMode, setFields, setFieldErrors, setSubmitError,
  setResultPanel)`.
- Grow the memoized `setters` object handed to `useLoginModal` to
  `{ setOpen, setResetToken, setResultPanel }`.
- Replace the inline `onSelectMode` handler with a named one that clears the panel and token
  before switching:
  `const handleSelectMode = (nextMode) => { setResultPanel(null); setResetToken(''); controller.switchMode(nextMode); };`
  and wire `onSelectMode: handleSelectMode`.
- `handleSubmit` passes the token through: `return controller.handleSubmit(mode, fields, resetToken);`.
- Add `resultPanel` to the state object passed to `LoginModalHelper.render({ ...fields, open,
  mode, fieldErrors, submitError, resultPanel }, { ... })`.
- Update the component JSDoc to mention the Recover / Set-new-password modes and that the modal
  stays open on a result panel for those two.

### `components/common/loginModal/hooks/useLoginModal.js`

- Change `buildLoginModalEffect(controller, { setOpen })` to
  `buildLoginModalEffect(controller, { setOpen, setResetToken, setResultPanel })`.
- In `handleToggle`, on an open request also do `setResetToken(detail.token ?? '')` and
  `setResultPanel(null)` before `controller.switchMode(detail.mode)`.
- Update `useLoginModal` (the wrapper) and both JSDoc blocks for the widened `setters` shape.

## Files to Change

- `frontend/assets/js/components/common/loginModal/LoginModal.jsx` — add `resetToken` /
  `resultPanel` state, thread `setResultPanel` into the controller, widen the hook setters,
  clear panel/token on mode switch, pass token into `handleSubmit`, add `resultPanel` to the
  render state.
- `frontend/assets/js/components/common/loginModal/hooks/useLoginModal.js` — accept
  `setResetToken` / `setResultPanel`, set the token and clear the panel on every open event.
