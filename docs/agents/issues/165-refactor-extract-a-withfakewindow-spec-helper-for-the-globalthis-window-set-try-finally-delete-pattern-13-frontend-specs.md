# Issue: Refactor: extract a withFakeWindow spec helper for the globalThis.window set/try/finally/delete pattern (13 frontend specs)

## Description
Many frontend specs fake `window` by assigning `globalThis.window`. Node-based Jasmine specs run without a DOM, so each spec installs its own stand-in and removes it afterwards. The install/cleanup boilerplate is copy-pasted per test or per spec.

## Problem
13 spec files under `frontend/specs` assign `globalThis.window`, using two different hand-rolled patterns:

- **Per-test `try/finally` + `delete globalThis.window`** (no save/restore): `HeaderControllerSpec.js` (5 tests), `AdminUsersControllerSpec.js` (3), `RegisterControllerSpec.js` (2), `AdminUserEditControllerSpec.js` (1), `AdminUserEditSpec.js` (1). `HeaderControllerSpec.js` is the worst offender: jscpd reports four clones totalling 53 lines (e.g. 53-68 ↔ 37-52, 85-99 ↔ 69-84), and it also repeats `new HeaderController(client)` per test.
- **`beforeEach` saves `originalWindow`, `afterEach` restores it**: `ResetPasswordLandingSpec.js`, `ModalRedirectSpec.js`, `useLoginModalSpec.js`, `LoginModalControllerSpec.js`, `useAuthEffectSpec.js`, `LoginModalEventsSpec.js`, `AuthEventsSpec.js`, `ApiClientSpec.js`.

The fake itself varies too: most use `{ location: { hash: ... } }`, while some (e.g. `useLoginModalSpec.js`) use a real `EventTarget` because the code under test dispatches/listens to window events.

Any spec that forgets the cleanup leaks a global `window` into later specs.

## Expected Behavior
A shared spec-support helper installs a fake `window` and always restores/removes it afterwards, and all 13 specs use it instead of hand-rolling the setup/cleanup. Test outcomes are unchanged.

## Solution
Add `frontend/specs/support/fakeWindow.js` (alongside `accountEditFormControllerExamples.js`, already within the frontend agent's scope) exporting `installFakeWindow(fake)`, used in a `beforeEach` and paired with an `afterEach` cleanup — no callback-style `withFakeWindow` wrapper.

- It accepts a caller-supplied fake (plain object or `EventTarget`) and installs it as `globalThis.window`.
- Cleanup restores the *previous* `globalThis.window` value, or deletes `window` when there was none. This is a small change for the try/finally specs (which currently always delete), but equivalent in Node, where `window` is undefined by default.
- The 5 try/finally specs move their per-test try/finally to `beforeEach`/`afterEach`; the 8 `originalWindow` specs drop their hand-rolled save/restore.

Start with `HeaderControllerSpec.js`, also replacing its repeated `new HeaderController(client)` with a `beforeEach`.

## Benefits
Removes dozens of repeated lines and the risk of a spec forgetting the cleanup and leaking a global `window` into later specs.
