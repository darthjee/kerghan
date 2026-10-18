# Awaiting-approval view

`Header` already wraps the page content and holds the auth state, so it keeps a `pending` state
(from step 01) and, while pending, renders a new `AwaitingApproval` component **instead of**
`children`, and the nav shows no logged-in menu (treat as logged out in `HeaderHelper`, without
the Login link if that would be confusing; ui.md only requires "no logged-in menu").

`AwaitingApproval` (new, e.g. `components/common/awaitingApproval/` with a controller, following
the component + controller + helper layout used elsewhere): a short message that the account is
waiting for an administrator's approval; **"Check again"** → the shared status re-check from
step 02; **"Log out"** → `AccountsClient.logout()` then `AuthEvents.emit(false, false, false)`
(reuse `HeaderController#handleLogout` if it fits). While mounted, subscribe to window `focus`
and re-check on it; unsubscribe on unmount; no `setInterval` / `setTimeout` polling. A re-check
answering `loggedIn: true` emits the logged-in state, so `Header` swaps back to `children` with
no new login; a logged-out answer emits the logged-out state with no denial message.

Tests (ui.md): view renders while pending and hides the logged-in menu; "Check again" calls
`status()`; "Log out" calls `logout()`; a focus event re-checks; no timer started; a
`loggedIn: true` re-check shows the app.

## Files to Change
- `frontend/assets/js/components/common/header/Header.jsx`, `helpers/HeaderHelper.jsx` — pending rendering.
- `frontend/assets/js/components/common/awaitingApproval/**` — new component, controller, focus hook.
- CSS for the view, wherever header/page styles live.
- matching specs under `frontend/specs/`.
