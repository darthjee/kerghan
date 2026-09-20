# Migrate HeaderControllerSpec
Migrate `HeaderControllerSpec.js` first — the worst offender (5 `try/finally` blocks, four jscpd clones totalling 53 lines). In `describe('#handleLogout')`, add a `beforeEach` that builds `fakeWindow = installFakeWindow({ location: { hash: '' } })` and `controller = new HeaderController(client)`, and an `afterEach` that calls `uninstallFakeWindow()`. Drop every per-test `try/finally`, `delete globalThis.window` and `new HeaderController(client)`, keeping each test's arrange (`client.logout.and...`, `AuthSession.set`) and assertions unchanged. Also hoist `new HeaderController(client)` into the top-level `beforeEach` for `#openLoginModal` / `#checkStatus` (declare `controller` alongside `client`), with `client` spy creation still preceding it.

## Files to Change
- `frontend/specs/assets/js/components/common/header/controllers/HeaderControllerSpec.js` — use the helper, remove try/finally, share `controller` via `beforeEach`
