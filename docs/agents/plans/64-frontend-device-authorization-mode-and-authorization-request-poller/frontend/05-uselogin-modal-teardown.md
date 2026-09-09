# useLoginModal poller teardown

Extend `buildLoginModalEffect` in `useLoginModal.js` so the poller is torn down whenever the
modal goes away, not only on an explicit mode switch:

- `handleToggle` — when `detail.open === false`, call `controller.stopPoller()` (alongside
  `setOpen(false)`).
- The returned cleanup function — call `controller.stopPoller()` alongside `mounted = false` /
  `LoginModalEvents.unsubscribe(...)`, so an unmount while a device request is in flight leaves
  no live timer.

`controller.stopPoller()` is null-safe (step 03), so both calls are harmless when the modal was
never in `device` mode. Update the `buildLoginModalEffect` JSDoc `controller` param to mention
`stopPoller`.

Extend `useLoginModalSpec.js`: a close event calls `controller.stopPoller()`; the cleanup
function calls `controller.stopPoller()`; the spy controller stub gains a `stopPoller` method.

## Files to Change

- `frontend/assets/js/components/common/loginModal/hooks/useLoginModal.js` — `stopPoller()` on
  the close event and on cleanup.
- `frontend/specs/assets/js/components/common/loginModal/hooks/useLoginModalSpec.js` — teardown
  coverage.
