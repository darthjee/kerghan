# Add redirect helpers and specs
Create `frontend/assets/js/utils/routing/redirects.js` with two named function exports, matching the function-export style of `redirectToModal` / `redirectToResetModal`:

- `redirectHome()` — returns immediately when `typeof window === 'undefined'`; otherwise sets `window.location.hash = '/'`.
- `redirectIfForbidden(error)` — returns `false` when `error.status !== 403`; otherwise calls `redirectHome()` and returns `true`.

Add `frontend/specs/assets/js/utils/routing/redirectsSpec.js` (mirroring the source path), using `installFakeWindow` / `uninstallFakeWindow` from `specs/support/fakeWindow.js`. Cover: `redirectHome` sets the hash to `'/'` when a window exists; `redirectHome` does nothing (and does not throw) when `window` is undefined; `redirectIfForbidden` returns `false` and leaves the hash untouched for a non-403 error; `redirectIfForbidden` returns `true` and sets the hash to `'/'` for a 403 error.

## Files to Change
- `frontend/assets/js/utils/routing/redirects.js` — new module with `redirectHome` and `redirectIfForbidden`
- `frontend/specs/assets/js/utils/routing/redirectsSpec.js` — new spec for both helpers
