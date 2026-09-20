# Add the fakeWindow helper
Create `frontend/specs/support/fakeWindow.js` exporting:

- `installFakeWindow(fake)` — installs `fake` (plain object or `EventTarget`) as `globalThis.window` and returns it, so callers can assert on the same object. On the *first* install since the last uninstall, it records whether `globalThis.window` was present (`'window' in globalThis`) and its value; later calls within the same test only swap in the new fake and keep that original.
- `uninstallFakeWindow()` — restores the recorded previous value, or `delete globalThis.window` when there was none. A no-op when nothing was installed, so it is safe in a top-level `afterEach` even for tests that never installed a fake.

Add JSDoc to both exports (lint requires it). Add `frontend/specs/support/fakeWindowSpec.js` covering: installs and returns the fake; deletes `window` on uninstall when none existed; restores a pre-existing `window`; a second install keeps the true original; uninstall without install is a no-op; uninstall twice is safe.

## Files to Change
- `frontend/specs/support/fakeWindow.js` — new helper module
- `frontend/specs/support/fakeWindowSpec.js` — new spec for the helper
