# Auth: user approval

Part of the [Auth module](../auth.md). Defines the optional admin approval of new registrations
and the admin deny of any account. Product decision: epic #389. Code:
`backend/src/auth/user-approval.config.ts`, the `status` column of
`backend/src/auth/entities/user.entity.ts`, and the status checks in `AuthService`,
`PasswordResetService`, `AuthorizationRequestService`, `AdminService` and
`SessionService#findActiveSessionUser`.

## Overview

Without this feature, anyone who registers gets a working account immediately. It lets an
instance require an admin to approve each new registration before the account can use Kerghan,
and lets admins deny (reject or ban) any account.

Every user has a `status`: `pending`, `approved` or `denied`. **Only `approved` users are
authenticated.** The session lookup in `JwtGuard` enforces this on every authenticated request,
always (see [Session lookup](../auth.md#jwtrefresh-token-flow)), so `pending` and `denied` users
are treated as anonymous by every business endpoint. A small set of auth endpoints reads the
real status explicitly (see [Explicit exceptions](#explicit-exceptions)).

## Configuration

`KERGHAN_USER_APPROVAL_REQUIRED` is an optional boolean flag, **off by default**, parsed like the
other `KERGHAN_*` boolean flags: exactly `true` turns it on, anything else leaves it off. Its row
is in [environment-variables.md](../../environment-variables.md#1-backend-application-runtime).
`UserApprovalConfig` (`user-approval.config.ts`) is its only reader, built once at boot by a
factory provider in `auth.module.ts`.

It decides **only** the initial status of a new self-registration
(`UserApprovalConfig#registrationStatus`, used by `AuthService#register`):

| Flag | Status of a new registration |
|---|---|
| off (default) | `approved` |
| on | `pending` |

It never:

- changes the status of existing users, when it is turned on or off;
- turns off the gate (the `approved` requirement is always enforced);
- hides or disables the admin review tools (status filter, approve, deny), which are always
  available.

## Status model

### The column

`auth_users.status`, `varchar(16)`, **NOT NULL**, with no column default. The values are the
`UserStatus` constants (`pending`, `approved`, `denied`). The service that creates a row
(registration, default-user boot sync, seeds) always sets it explicitly. **Why no default:** an
implicit default could silently grant access.

The status is **not** part of the `user` payload of the auth endpoints, which stays
`{ id, username, email, isAdmin }`. It is exposed only to admins, as the `status` field of the
admin user items (see [Admin review](#admin-review)), and to the caller as
`status: "pending"` on `status.json` (see
[Auth routes](../../backend/routes/auth.md#post-authstatusjson)).

### Transitions

```text
pending ──approve──▶ approved
   │                    │
   └──────deny──────▶ denied ◀──deny── (any status)
```

| Action | From | To | Rule |
|---|---|---|---|
| Approve | `pending` only | `approved` | Strict: any other status is refused with `422 USER_NOT_PENDING` |
| Deny | any (`pending`, `approved`, `denied`) | `denied` | Lenient: denying an already `denied` user succeeds, leaves the status as it is, and still revokes the sessions |

**Why strict approve and lenient deny:** deny covers both "reject" (from `pending`) and "ban"
(from `approved`), so it accepts every status. Approving anything but a pending user would turn
approve into an un-deny. Approve is a conditional `UPDATE ... WHERE status = 'pending'`, so a
concurrent deny can never be overwritten by an approve.

- **`denied` is final**: no transition leaves it. There is no un-deny through the API; the only
  way back is a DB change.
- Status changes **only** through approve and deny. The admin edit route
  (`POST /admin/users/:id/edit.json`), My Account (`PATCH /auth/account.json`), password reset
  and every other write path never change `status`.
- No automatic transition: turning `KERGHAN_USER_APPROVAL_REQUIRED` on or off changes no
  existing user.

### Migration and seeds

`database/migrations/20261017120020-auth-add-users-status.ts` adds the column and **backfills
every existing user to `approved`**, in the same deploy as the gate's `approved` requirement.
**Why the backfill is mandatory:** the gate is always enforced, so a user left without
`approved` would be locked out. That is also why the migration is not skipped in production.
Its `down` drops the column.

The demo users seeded for dev and manual testing are `approved`: the seed migrations run before
the `status` migration, so the backfill covers them. Any seed added after it must insert
`approved` explicitly.

## Explicit exceptions

Business endpoints never check the status: the gate does. Only these auth endpoints read the
real status. Their exact contracts are in [Auth routes](../../backend/routes/auth.md).

| Endpoint | Why it reads the status |
|---|---|
| `POST /auth/login.json` | `denied` → `403 USER_DENIED`, only after the password is verified |
| `POST /auth/status.json` | Reports `pending`, so the frontend can show the awaiting-approval view |
| `POST /auth/recover.json`, `POST /auth/reset-password.json` | Must never reveal the status; a denied user cannot reset |
| `POST /auth/authorization-requests/:uuid/poll.json` | Never mints a session for a non-approved user (the [`logged → denied`](../auth.md#status-machine) transition) |
| `POST /auth/refresh.json` | Rejects a denied user's token; keeps rotating a pending user's session |

`refresh.json` is `@Public()`, so the gate does not cover it. It keeps rotating a pending user's
session, so the session survives until an approval (the access tokens it mints are blocked by the
gate meanwhile). It rejects a denied user's still-active token with the plain `401` and revokes
it with `admin_denied`. **Why, when deny already revokes every session:** a rotation or a winning
poll racing the deny's bulk revoke can insert a new active row after it; this check stops such a
session from rotating on.

## Non-disclosure

- A **denied** account looks like a logged-out or unknown one everywhere, except login **after a
  correct password** (`403 USER_DENIED`). A wrong password keeps the existing `401`, so the
  denied status cannot be probed without the password.
- `status.json` reveals only `pending`, and only to the holder of that user's valid session. A
  denied user's `status.json` is byte-for-byte the anonymous answer.
- Password recovery has the same observable effects (response, timing class, side effects
  visible to the caller) for every status.
- On business endpoints, a pending or denied user's request gets the same `401` body as an
  invalid or expired access token (see
  [Session lookup](../auth.md#jwtrefresh-token-flow)).

## Admin review

All admin review routes live on `AdminController` (default `JwtGuard` plus `@AdminOnly()`,
`@CachePolicy(CacheClass.Never)`, thin controller delegating to `AdminService`). They are
**always available**, whatever `KERGHAN_USER_APPROVAL_REQUIRED` says. Route table:
[Admin tool routes](../auth.md#admin-tool-routes-admincontroller-admin-prefix).

- **User item:** `{ id, username, email, isAdmin, createdAt, status }`, never the password
  digest, tokens or sessions. `search.json` also returns `currentUserId`, the calling admin's
  own id, so the admin page can hide deny on the caller's own row (`status.json` exposes no user
  id).
- **Search:** optional `status` filter (`pending`, `approved`, `denied`; anything else →
  `400 VALIDATION_FAILED`), combined with `q` (AND). Still unpaginated.
- **Approve** (`approve.json`): `404` for an unknown id; `422 USER_NOT_PENDING` when the user is
  not `pending`, with nothing changed; otherwise `200 { user }` with status `approved`. Sessions
  are untouched: a pending user's existing session becomes usable on its next request, with no
  new login.
- **Deny** (`deny.json`), checked in this order: `404` for an unknown id;
  `409 DEFAULT_USER_MANAGED` for the default user (see [Default user](#default-user));
  `422 CANNOT_DENY_SELF` for the caller's own id; otherwise `200 { user }` with status `denied`,
  from any status. On success, every **active** refresh token of the user is revoked with
  `admin_denied` (`TokenService#revokeUserTokens(userId, RevokedReason.ADMIN_DENIED)`), also when
  the user was already denied. Already-revoked rows keep their reason, so replay evidence is
  kept. `admin_denied` is not `rotated`, so a later refresh of those tokens never triggers replay
  detection. Replaying an older, unexpired `rotated` token of a denied user still does, which is
  harmless (nothing active is left). With the gate, the user is logged out everywhere on their
  next request.
- **Admins can deny admins.** Any admin may deny any other user, other admins included: only
  oneself and the default user are protected (decision #389). This is an accepted risk: through
  the API, one admin can deny every other non-default admin, and the only way back is a DB
  change.
- **Other admin routes are unchanged** for every status: `edit.json`, `recovery-link.json` and
  `send-recovery-email.json`. **Why:** they are admin-only (the admin already sees the status),
  they never change `status`, and a recovery token issued for a denied user is refused by
  `reset-password.json`. Nothing about them is visible to the user beyond what an admin chooses
  to send.

## Default user

While the default-user feature is enabled, `status` is a **managed field** of the
[default user](default-user.md): boot sync forces it to `approved` on every boot, whether the row
is created or updated. So a default user denied directly in the DB is approved again on the next
boot. The admin deny route refuses it with `409 DEFAULT_USER_MANAGED`, identifying it by id
(`DefaultUserService#assertNotDefaultUser`), as in
[Edit blocking](default-user.md#identifying-the-default-user). With the feature off, boot sync
does not run and that row is a regular user, which can be denied.

The default user is therefore always `approved`, so automatic login on `status.json` never logs
anyone in as a pending or denied user.

## Frontend

### Auth state

- The auth state gains **`pending`**, set from `status.json`'s `status: "pending"` and carried
  on the `client/AuthEvents.js` bus next to `loggedIn` and `isAdmin`
  (`AuthEvents.emit(loggedIn, isAdmin, pending)`).
- While pending, `loggedIn` and `isAdmin` are `false`, so nothing that needs a logged-in user is
  shown and the header shows no logged-in menu.
- `client/AuthStatus.js` (`AuthStatus.refresh`) is the shared "call `status.json` and emit the
  result" step, used by the header's mount-time check, a successful login or registration, and
  the awaiting-approval re-check.

### After register and login

The frontend **re-checks `status.json`** after a successful register or login instead of
assuming a logged-in state. The register and login responses are unchanged; `status.json` is the
single source of the status. Approved → the logged-in state; pending → the awaiting-approval
view.

### Awaiting-approval view

`components/common/awaitingApproval/`: `AwaitingApprovalGate` swaps the app content for the
full-page `AwaitingApproval` view while pending (wired in `Header.jsx`). The view shows:

- a short message saying the account is waiting for an administrator's approval;
- **"Check again"**, which re-checks `status.json`;
- **"Log out"**, which calls `DELETE /auth/logoff.json` (reusing the header's logout) and returns
  to the logged-out state.

### Picking up the approval

- `status.json` is re-checked on **window focus** (`hooks/useWindowFocusRecheck.js`) and on
  "Check again".
- **No timer polling.** **Why:** `status.json` is never cached and hits the DB.
- When a re-check answers `loggedIn: true`, the view is replaced by the normal app, with no new
  login.
- When it answers logged out (the account was denied, or the session expired), the frontend
  switches to the normal logged-out state. Nothing says the account was denied.

### Denied login

On `403 USER_DENIED` from `login.json`, the login modal shows "This account has been denied
access." (`USER_DENIED_MESSAGE` in `loginModal/controllers/LoginErrorMessages.js`). It is only
ever reached after a correct password; a wrong password keeps the usual credentials error. A
`403` does not trigger `ApiClient`'s refresh-and-retry, which only reacts to `401`.

### Admin users page

On the admin users page (`components/resources/admin/pages/AdminUsers.jsx`, its helper and
controller, and `pages/users/ApproveUserButton.jsx` / `DenyUserButton.jsx`), through
`client/AdminClient.js` (`searchUsers(q, status)`, `approveUser`, `denyUser`):

- a **status filter** sent as `status` to `search.json`, with an "all" option (no `status`
  sent) and a **pending** view, combined with the search box (`q`);
- the **status of each user** in the listing;
- **Approve**, shown only for `pending` users;
- **Deny** (reject a pending user, ban an approved one), behind a browser confirmation, since it
  is final and logs the user out everywhere;
- **no action where the API would refuse it:** no deny on the admin's own row (the one whose `id`
  equals `currentUserId` from the last `search.json`), no approve on a non-pending user, no deny
  on a `denied` user. The admin item carries no default-user marker (a read-side indicator is out
  of scope, see [Default user → Out of scope](default-user.md#out-of-scope)), so deny is offered
  on the default user's row and its `409 DEFAULT_USER_MANAGED` message is shown;
- **errors shown to the admin:** `422 USER_NOT_PENDING`, `422 CANNOT_DENY_SELF` and
  `409 DEFAULT_USER_MANAGED` show their `error.message` (e.g. after a concurrent change by another
  admin). After any action, the listing shows the user's new status.

## Out of scope

- **Notifications:** approve and deny send nothing, and admins are not alerted of new pending
  registrations.
- **Pagination** of the admin user listing (a separate issue).
- **Leaving `denied`:** there is no un-deny.
- **Slimming the JWT payload** to `{ sub, sid }`: a possible later cleanup, now that `username`
  and `isAdmin` are no longer trusted from the token.

## Testing

Backend (`backend/src/`):

- `auth/tests/user-approval.config.spec.ts` — flag parsing and the registration status.
- `database/tests/auth-add-users-status-migration.spec.ts` — the `approved` backfill and the
  `down`.
- `auth/tests/session.service.spec.ts` (`findActiveSessionUser` matches only an approved user)
  and `auth/tests/auth.controller.session-gate.e2e-spec.ts` (pending and denied users get the
  invalid-token `401` byte-for-byte, and a pending session passes once approved) — the gate's
  `approved` requirement and its non-disclosure.
- `auth/tests/admin.service.spec.ts` and `auth/tests/admin.controller.e2e-spec.ts` — search
  filter, approve, deny and the session revocation.
- `auth/tests/auth.controller.login.e2e-spec.ts`, `auth.controller.register.e2e-spec.ts`,
  `auth.controller.recovery.e2e-spec.ts`, `auth.controller.refresh-logout.e2e-spec.ts` and
  `auth.controller.auto-login.e2e-spec.ts` — the status-aware auth endpoints.
- `auth/tests/authorization-request.service.poll.spec.ts` and
  `authorization-request.controller.poll.e2e-spec.ts` — the `logged → denied` poll.
- `auth/tests/default-user.service.spec.ts` — boot sync forcing `approved`.

Frontend (`frontend/specs/assets/js/`):

- `client/AuthStatusSpec.js` — the pending state on the bus.
- `components/common/awaitingApproval/` — the gate, the view, its controller and helper, and the
  focus re-check.
- `components/common/loginModal/controllers/LoginModalControllerStatusRecheckSpec.js` and
  `LoginModalControllerDeniedSpec.js` — the re-check after login/register and the denied
  message.
- `components/resources/admin/pages/users/ApproveUserButtonSpec.js` and `DenyUserButtonSpec.js` —
  the admin actions.
