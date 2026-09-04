# Propagate isAdmin through the app's auth state

Today `AuthEvents` only ever carries a `loggedIn` boolean (`emit(loggedIn)`,
`detail: { loggedIn }`), and `Header` only tracks a `loggedIn` state. Extend this the same way,
end to end, to also carry `isAdmin` — every existing caller of `AuthEvents.emit` and every
consumer of its event must be updated together, or the two get out of sync.

- `frontend/assets/js/client/AuthEvents.js` — `emit(loggedIn, isAdmin = false)`, dispatch
  `detail: { loggedIn, isAdmin }`. `subscribe`/`unsubscribe` are unchanged.
- `frontend/assets/js/client/AccountsClient.js` — `status(refreshToken)`'s return type becomes
  `Promise<{ loggedIn: boolean, isAdmin: boolean }>` (no client-side change needed beyond the
  JSDoc — it already just forwards the backend's JSON body).
- `frontend/assets/js/components/common/header/controllers/HeaderController.js` —
  `checkStatus()`: destructure `{ loggedIn, isAdmin }` from `this.client.status(token)`, emit
  both (`AuthEvents.emit(loggedIn, isAdmin)`); the no-token early-return path emits `(false,
  false)`. `handleLogout()`: emit `(false, false)` in the `finally` block.
- `frontend/assets/js/components/common/header/hooks/useAuthEffect.js` — `buildAuthEffect` reads
  `event.detail?.isAdmin` too; `useAuthEffect`'s caller (`Header`) needs both values, so change
  its second parameter from a single `setLoggedIn` setter to an object of setters (or two
  parameters) — keep whichever shape reads cleanest, this file's existing tests will need the
  same shape update.
- `frontend/assets/js/components/common/header/Header.jsx` — add an `isAdmin` state
  (`useState(false)`, seeded false since there's no admin-equivalent of `AuthSession`'s
  synchronous local check — admin status is only known after `checkStatus()` resolves), pass both
  `loggedIn` and `isAdmin` into `HeaderHelper.render`.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — `render`/
  `#renderAuthLinks` take an `isAdmin` param; render an "Admin Users" `<Nav.Link>` only when
  `isLoggedIn && isAdmin` (its `href` is finalized in step 04, once the route itself is wired up).
- `frontend/assets/js/components/resources/accounts/pages/controllers/LoginController.js` — after
  `const result = await this.client.login(fields);`, emit `AuthEvents.emit(true,
  result.user.isAdmin)` instead of the current `emit(true)`.
- `frontend/assets/js/components/resources/accounts/pages/controllers/RegisterController.js` —
  same change as `LoginController`, using its own post-registration `AuthEvents.emit` call.

## Files to Change

- `frontend/assets/js/client/AuthEvents.js`
- `frontend/assets/js/client/AccountsClient.js` (JSDoc only)
- `frontend/assets/js/components/common/header/controllers/HeaderController.js`
- `frontend/assets/js/components/common/header/hooks/useAuthEffect.js`
- `frontend/assets/js/components/common/header/Header.jsx`
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`
- `frontend/assets/js/components/resources/accounts/pages/controllers/LoginController.js`
- `frontend/assets/js/components/resources/accounts/pages/controllers/RegisterController.js`
- specs for every file above under each component's `tests`/`specs` sibling — update
  `AuthEvents.emit` call assertions and effect/state expectations for the new `isAdmin` value.
