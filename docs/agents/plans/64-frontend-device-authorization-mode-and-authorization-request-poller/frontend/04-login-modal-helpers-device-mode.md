# Login modal helpers: selector, form, panels, countdown

`LoginModalFormsHelper.jsx`:

- `MODE_TABS` — add `['device', 'Authorize with logged device']` as the fourth entry.
- `FIELDS_BY_MODE.device = [['username', 'text', 'Username']]`.
- `SUBMIT_LABELS.device = 'Send request'`.
- Thread `state` into `#renderResultPanel` (today it only receives `panel` + `handlers`) so the
  waiting panel can read `state.deviceExpiresAt` and a `state.now` (or precomputed
  `state.deviceRemainingMs`). Factor a `#renderDevicePanel(panel, state, handlers)` sub-method
  to keep within the complexity-10 / 300-line caps.
- Device panels:
  - `device:waiting` → spinner + "Waiting for another device to approve…" + a live `mm:ss`
    countdown to `state.deviceExpiresAt`. **No** retry control.
  - `device:denied` → "The request was denied on the other device." + retry.
  - `device:expired` → "The request expired before it was approved." + retry.
  - `device:logged` → "This login was already completed on another device." + retry.
  - `device:notFound` → "That request could not be found." + retry.
  - The retry control is a `btn btn-link` calling `handlers.onSelectMode('device')`, which routes
    through `switchMode('device')` — clearing the panel and resetting to the empty username form.
- `render` already short-circuits to `#renderResultPanel` whenever `state.resultPanel` is set, so
  the device panels reuse that path with no change to `render` beyond passing `state` down.

`LoginModalHelper.jsx`:

- `TITLES.device = 'Authorize with logged device'`.

Extend `LoginModalFormsHelperSpec.js` and `LoginModalHelperSpec.js`: fourth selector button
present and wired to `onSelectMode('device')`; `device` form renders a lone username field with
the `Send request` label; each `device:*` panel renders its copy; terminal panels render a retry
button calling `onSelectMode('device')`; waiting panel renders the countdown from
`state.deviceExpiresAt` and no retry button; `TITLES.device` mapping.

## Files to Change

- `frontend/assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx` —
  `MODE_TABS`, `FIELDS_BY_MODE`, `SUBMIT_LABELS`, `#renderDevicePanel` + countdown.
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalHelper.jsx` — `TITLES.device`.
- `frontend/specs/assets/js/components/common/loginModal/helpers/LoginModalFormsHelperSpec.js` —
  selector, form, panels, countdown, retry.
- `frontend/specs/assets/js/components/common/loginModal/helpers/LoginModalHelperSpec.js` — title.
