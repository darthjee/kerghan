# Add AccountsClient.status() and HeaderController.checkStatus()

`AccountsClient` gains a `status(refreshToken)` method matching the shape of its
existing `login`/`refresh`/`logout` methods (`frontend/assets/js/client/AccountsClient.js`):

```js
static async status(refreshToken) {
  return ApiClient.postJson('/auth/status.json', { refreshToken });
}
```

Unlike the other methods, this one does **not** touch `AuthSession` itself — that's the
caller's responsibility (see below), since a `false` result here means clearing a
now-known-stale token, not setting a new one.

`HeaderController` (`frontend/assets/js/components/common/header/controllers/HeaderController.js`)
gains:

```js
async checkStatus() {
  const token = AuthSession.get();

  if (!token) {
    AuthEvents.emit(false);
    return;
  }

  const { loggedIn } = await this.client.status(token);

  if (!loggedIn) {
    AuthSession.clear();
  }

  AuthEvents.emit(loggedIn);
}
```

Skipping the network call entirely when there's no stored token avoids a pointless
request and matches the "no token → definitely logged out" case. Clearing `AuthSession`
on a `false` result prevents `ApiClient`'s existing 401-retry logic
(`ApiClient.js:80-96`) from later attempting to refresh with a token the backend already
reported as dead.

Also add `AuthEvents.emit(false)` to the existing `handleLogout`'s `finally` block
(`HeaderController.js:32-34`), alongside the existing `AuthSession`-clearing/redirect —
this already runs regardless of whether the network logout call succeeded, so the emit
inherits that same guarantee.

## Files to Change

- `frontend/assets/js/client/AccountsClient.js` — add `status(refreshToken)`.
- `frontend/specs/assets/js/client/AccountsClientSpec.js` — cover `status()`: posts to
  `/auth/status.json` with `{ refreshToken }`, returns the parsed `{ loggedIn }` body
  unchanged, does not touch `AuthSession`.
- `frontend/assets/js/components/common/header/controllers/HeaderController.js` — add
  `checkStatus()`; add `AuthEvents.emit(false)` to `handleLogout`'s `finally` block.
- `frontend/specs/assets/js/components/common/header/controllers/HeaderControllerSpec.js`
  — cover `checkStatus()`'s three branches (no token → emits `false`, no network call;
  token valid → emits `true`, `AuthSession` untouched; token invalid → emits `false`,
  `AuthSession.clear()` called); cover that `handleLogout` now also emits `false`.
