# Issue: User-side approval flow (backend + frontend)

## Description

Third sub-issue of the user approval Epic (#389). Implement the user-side approval flow, backend
and frontend, exactly as defined in `docs/agents/specs/user-approval/` (`model.md`,
`security.md`, `api.md` user endpoints, `ui.md` user side). Builds on the `sid` session-lookup
gate shipped by #391. Admin approve / deny (#393) and the specs fold-in (#394) come after.

## Problem

Today every self-registered user gets a working account immediately, and nothing lets an instance
hold new accounts for review or keep a banned account out. Users have no status, and the gate
added by #391 checks only that the session is live, not who the user is allowed to be.

## Expected Behavior

### Model and flag ([model.md](../specs/user-approval/model.md))

- New `auth_users.status` column (`pending` | `approved` | `denied`, NOT NULL), always set
  explicitly by the creating service, never by an implicit default. One migration adds it and
  backfills **every existing user to `approved`** (mandatory, the gate is always enforced);
  `down` drops the column.
- `status` is not added to the `user` payloads of the auth endpoints.
- `KERGHAN_USER_APPROVAL_REQUIRED` (optional boolean, default off, parsed by the shared
  `KERGHAN_*` boolean-flag parser) decides only the status of a new registration: off →
  `approved`, on → `pending`. Flipping it changes no existing user and never disables the gate.
  Documented in `docs/agents/environment-variables.md`.
- Standalone: a **plain optional pass-through**: listed by name in the `kerghan` service's
  `environment:` in `standalone/vault/docker-compose.yml` and added to the "Optional
  pass-through (allowlist)" row of `environment-variables.md`. The `kerghan` client never writes
  it and `update-env` does not add it.
- Default user: `status` becomes a managed field, forced to `approved` by the boot sync on create
  and update. Demo seed users are `approved` (existing seeds via the backfill; later seeds insert
  it explicitly).

### Gate ([security.md](../specs/user-approval/security.md))

- `JwtGuard`'s session lookup adds rule 3: the joined user must be `approved`, **whatever the
  flag**. A non-approved user gets the same `401` as an invalid / expired access token, with no
  status-specific code.

### Auth endpoints ([api.md](../specs/user-approval/api.md#user-endpoints))

- New `ErrorCodes.USER_DENIED` and `RevokedReason.ADMIN_DENIED` (`admin_denied`).
- **`register.json`:** status from the flag; response and cookies unchanged for every status.
- **`login.json`:** wrong credentials → existing `401` whatever the status; correct password and
  `denied` → `403 USER_DENIED`, no session or cookie; `pending` → normal `200` with a session
  (blocked by the gate).
- **`status.json`:** `pending` → `{ loggedIn: false, isAdmin: false, status: "pending" }` with the
  session cookies **kept**; `denied` → byte-for-byte the anonymous answer (falls through to the
  no-session flow, including automatic login), a still-active presented token revoked with
  `admin_denied`. `status` appears only for `pending`.
- **`refresh.json`:** `pending` keeps rotating; `denied` → plain `401`, cookies cleared, still-active
  token revoked with `admin_denied`. The status check runs only after the existing token checks,
  so replay detection is never skipped.
- **`recover.json`:** always `200 { sent: true }`; a `denied` user is treated like an unknown
  email (no token, no email).
- **`reset-password.json`:** a valid token for a `denied` user → the generic `400` "Invalid or
  expired token", password unchanged, token not consumed; a `pending` user resets and stays
  `pending`.
- **Device authorization:** `authorize.json` unchanged (the gate answers `401`). `poll.json`
  re-checks the freshly loaded user right before minting; a non-approved user gets
  `{ status: "denied" }`, no `user`, no cookies, and the request flips `logged → denied` with a
  conditional `UPDATE ... WHERE status = 'logged'` (new transition).
- Status rules live in the services (`AuthService`, `PasswordResetService`,
  `AuthorizationRequestService`), never the controllers.

### Frontend ([ui.md](../specs/user-approval/ui.md#user-side))

- Auth state gains `pending` (from `status.json`), carried on the `AuthEvents` bus with
  `loggedIn` / `isAdmin` false.
- After a successful register or login, the frontend re-checks `status.json` instead of assuming
  logged in, and routes to logged-in or awaiting approval.
- A full-page awaiting-approval view replaces the app content while pending: message, "Check
  again" (re-checks `status.json`) and "Log out" (`DELETE /auth/logoff.json`); no logged-in header
  menu.
- Re-check on window focus and on "Check again", **no timer polling**. `loggedIn: true` shows the
  app with no new login; a logged-out answer switches to the normal logged-out state with no
  mention of denial.
- On `403 USER_DENIED`, the login modal shows "This account has been denied access."

### Cache

- Every changed route stays `@CachePolicy(CacheClass.Never)` (`X-Skip-Cache: true`); the `cache`
  agent confirms none belongs in `navi/resources/*.yml`.

### Tests

Every "Required tests" item of `model.md`, the #392 items of `security.md` (status, non-disclosure),
the user-endpoint items of `api.md`, the user-side items of `ui.md`, and the flag-parser coverage
from `README.md`.

## Solution

Specialists: **backend** (migration, entity, flag config, gate rule 3, auth / password-reset /
device-authorization services, default-user boot sync, env-var docs), **frontend** (auth state,
re-check after register / login, awaiting-approval view, denied login message), **cache**
(policy review), **standalone** (flag pass-through in `standalone/vault/docker-compose.yml`).

## Out of scope

- Admin status filter, approve and deny endpoints and UI (#393).
- Folding the specs into permanent docs, including the `logged → denied` transition in
  `modules/auth.md` and the default-user managed-field lists (#394).
- Notifications, pagination, leaving `denied`.
