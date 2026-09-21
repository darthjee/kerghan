# Plan: Refactor: extract a captured-handlers helper for React page specs (AuthorizationRequests, AdminUsers, AdminUserEdit, MyAccount)

Issue: [173-refactor-extract-a-captured-handlers-helper-for-react-page-specs-authorizationrequests-adminusers-adminuseredit-myaccount.md](../../issues/173-refactor-extract-a-captured-handlers-helper-for-react-page-specs-authorizationrequests-adminusers-adminuseredit-myaccount.md)

## Overview
Every handler-delegation test in the four page specs repeats:

```js
let capturedHandlers;
spyOn(SomeHelper, 'render').and.callFake((_state, handlers) => {
  capturedHandlers = handlers;
  return React.createElement('div');
});
renderToStaticMarkup(React.createElement(Page));
```

and `MyAccountSpec.js` / `AdminUserEditSpec.js` share a near-identical "passes the default state to the helper" test. This plan extracts both into `frontend/specs/support/`, following the conventions already used there (`fakeWindow.js` + `fakeWindowSpec.js`, `itBehavesLike…` example groups, JSDoc on every export). No production code under `frontend/assets/` changes.

## Context
- The issue is confined to `frontend/specs/`, so `frontend` is the sole owner.
- Out of scope (per the issue discussion): the repeated `fakeEvent = { preventDefault: … }` line and the repeated `spyOn(Controller.prototype, 'load')` lines stay in the tests.
- Default states differ: `MyAccount` includes `currentPassword`, `AdminUserEdit` does not; the shared example must take the expected state as an option.
- Per-test setup (controller spies, `installFakeWindow`, the `afterEach(uninstallFakeWindow)` in `AdminUserEditSpec.js`) stays in the specs.

## Steps

- [01 — Add renderCapturingHandlers helper](frontend/01-add-render-capturing-handlers.md)
- [02 — Add shared default-state example](frontend/02-add-default-state-example.md)
- [03 — Migrate the four page specs](frontend/03-migrate-page-specs.md)
- [04 — Verify](frontend/04-verify.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn test` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- Never run `yarn`/`npm` directly on the host (see `CLAUDE.md` Boundaries) — always through `docker-compose`.
- Codacy/jscpd duplication is the motivation: after the change the clones listed in the issue should be gone from these four specs.
- Whether the default-state example lives in a new file or an existing support file is decided in step 02 (recommended: new `accountEditPageExamples.js`, since `accountEditFormHelperExamples.js` is about the *Helper* under test, not the page).
