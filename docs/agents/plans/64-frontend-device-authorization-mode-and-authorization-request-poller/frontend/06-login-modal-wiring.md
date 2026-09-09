# LoginModal.jsx device state wiring

`LoginModal.jsx`:

- Add `const [deviceExpiresAt, setDeviceExpiresAt] = useState(null);`
- Pass `setDeviceExpiresAt` into the `LoginModalController` constructor as the new positional arg
  (per step 03), keeping the `useMemo` dependency list empty as today.
- Countdown ticker: a `useEffect` keyed on `resultPanel` that, while
  `resultPanel === 'device:waiting'`, starts a 1s `setInterval` bumping a `now` state and clears
  it on cleanup / panel change. Pass `deviceExpiresAt` and `now` (or a precomputed
  `deviceRemainingMs`) into the state object handed to `LoginModalHelper.render`.
- `handleSelectMode` already calls `controller.switchMode`, which now also tears down the poller
  and clears `deviceExpiresAt` — no change needed beyond confirming `setResultPanel(null)` still
  runs first.
- `onClose` is unchanged: it fires `LoginModalEvents.close()`, which the `useLoginModal` effect
  (step 05) turns into `stopPoller()`.

Extend `LoginModalSpec.js`: opening in `device` mode renders the username form; submitting drives
`controller.handleSubmit('device', …)`; while `device:waiting` the countdown element is present
and advances on a `jasmine.clock()` tick; switching away clears the interval.

## Files to Change

- `frontend/assets/js/components/common/loginModal/LoginModal.jsx` — `deviceExpiresAt` state,
  countdown ticker effect, controller constructor wiring.
- `frontend/specs/assets/js/components/common/loginModal/LoginModalSpec.js` — device-mode render
  + countdown.
