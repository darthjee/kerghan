# User approval — UI

Frontend behavior. User side built by #392, admin side by #393. Index: [README.md](README.md).

## User side

### Auth state

- The auth state gains **`pending`**, set from `status.json`'s `status: "pending"` (see
  [api.md](api.md#post-authstatusjson)) and carried on the `AuthEvents` bus next to `loggedIn`
  and `isAdmin`.
- While pending, `loggedIn` and `isAdmin` are `false`: nothing that needs a logged-in user is
  shown.

### After register and login

The frontend **re-checks `status.json`** after a successful register or login instead of
assuming a logged-in state (today `RegisterController` emits logged-in and redirects home). The
register and login responses are unchanged; `status.json` is the single source of the status.

- Approved → logged-in state, as today.
- Pending → the awaiting-approval view.

### Awaiting-approval view

A **full-page view replaces the app content while pending**:

- a short message saying the account is waiting for an administrator's approval;
- a **"Check again"** action, which re-checks `status.json`;
- a **"Log out"** action, which calls `DELETE /auth/logoff.json` and returns to the logged-out
  state.

The header shows no logged-in menu while pending.

### Picking up the approval

- Re-check `status.json` on **window focus** and on **"Check again"**.
- **No timer polling**: `status.json` is never cached and hits the DB.
- When the re-check answers `loggedIn: true`, the view is replaced by the normal logged-in app,
  with no new login.
- When it answers logged out (the account was denied, or the session expired), the frontend
  switches to the normal logged-out state; nothing says the account was denied.

### Denied login

On `403 USER_DENIED` from `login.json`, the login modal shows an explicit message, e.g. "This
account has been denied access." It is only ever reached after a correct password (a wrong
password keeps the usual credentials error).

## Admin side

On the existing admin users page (`frontend/assets/js/components/resources/admin/`):

- **Status filter** sent as `status` to `search.json`, with an "all" option and a **pending**
  view; combinable with the existing search box (`q`).
- **Status of each user** shown in the listing.
- **Approve** action, shown only for `pending` users.
- **Deny** action (reject a pending user, ban an approved one), behind a confirmation, since it
  is final and logs the user out everywhere.
- **No action offered where the API would refuse it:** no deny on the admin's own row, no approve
  on a non-pending user, no action on a `denied` user. The admin user item carries no
  default-user marker (a read-side default-user indicator is out of scope, see
  [Default user](../../modules/auth/default-user.md#out-of-scope)), so deny is offered on the
  default user's row like any other and its `409 DEFAULT_USER_MANAGED` message is shown.
- **Errors surfaced to the admin:** `422 USER_NOT_PENDING`, `422 CANNOT_DENY_SELF` and
  `409 DEFAULT_USER_MANAGED` show their `error.message` (e.g. after a concurrent change by another
  admin); after any action the listing reflects the user's new status.

## Required tests

- **Bus:** a `status: "pending"` answer emits the pending state with `loggedIn` / `isAdmin`
  false.
- **Re-check:** register and login each trigger a `status.json` call and route to logged-in or
  awaiting-approval from its answer.
- **Awaiting view:** renders while pending, hides the logged-in header menu; "Check again"
  re-checks; "Log out" logs off.
- **Focus re-check:** a window focus while pending re-checks `status.json`; no timer is started.
- **Approval picked up:** a re-check answering `loggedIn: true` shows the app.
- **Denied login:** a `403 USER_DENIED` shows the denied message in the login modal.
- **Admin filter:** each filter value sends the matching `status`, combined with `q`.
- **Admin actions:** approve shown only for pending; deny hidden on own row; deny on the default user shows the `409` message;
  deny asks for confirmation; success updates the row; `422` / `409` errors are displayed.
