# Verify
Run the frontend suite and lint through docker-compose (never directly on the host): `docker-compose run kerghan_fe yarn coverage` and `docker-compose run kerghan_fe yarn lint`. Confirm the spec count/outcomes are unchanged apart from the new `fakeWindowSpec.js` cases. Then `grep -rn "globalThis.window =\|delete globalThis.window\|originalWindow" frontend/specs` should only match `support/fakeWindow.js` (and its spec). Where tooling allows, re-check with jscpd that the `HeaderControllerSpec.js` clones are gone.

## Files to Change
- None expected — only fix-ups for anything the checks above surface.
