# Issue: Specs: user approval feature definition

## Description

First sub-issue of the user approval Epic (#389). Write the feature specs for an optional admin
approval of new user registrations, following the lifecycle in `docs/agents/specs.md`
(precedent: the default user specs, #367).

Feature summary (full context in #389):

- New flag `KERGHAN_USER_APPROVAL_REQUIRED` (default off). It only decides the initial status of
  new registrations: off → `approved`, on → `pending`. It never changes existing users.
- Each user has a `status`: `pending`, `approved`, `denied`. Approve only from `pending`; deny
  from any status (reject or ban); `denied` is final.
- The authentication gate is always enforced: `JwtGuard` checks, on every authenticated request,
  an active refresh-token session for the access token's `sid` claim, owned by `sub`, whose user
  is `approved`. Non-approved users are treated as anonymous.
- Explicit exceptions read the real status: login (`denied` → `403`), status (reports
  `pending`), password recovery/reset (never reveal status), device authorization (never issue
  tokens to non-approved users).
- Admin: `status` filter/field on `POST /admin/users/search.json`,
  `POST /admin/users/:id/approve.json`, `POST /admin/users/:id/deny.json` (revokes every
  session; never on the default user or on oneself). Always available, whatever the flag.
- No notifications; no pagination.

## Problem

The approval flow touches the global authentication guard, the session model, several public
auth endpoints, the admin tools and the frontend, across three implementation
sub-issues (#391, #392, #393). Without one agreed definition, each would make its own decisions about statuses,
the gate, error codes, non-disclosure rules and UI behavior, and they would drift apart.

## Expected Behavior

- `docs/agents/specs/user-approval/` exists with `README.md`, `model.md`, `security.md`,
  `api.md` and `ui.md`, each ending with a "Required tests" section.
- The feature is listed under "Active specs" in `docs/agents/specs.md`.
- Every decision below is captured in the spec file that owns it, so #391–#394 can build against
  the specs without re-deciding anything.
- No code changes.

## Solution

### Spec files

A single spec issue (unlike the default user, whose specs grew over #367, #374 and #375): the
decisions below were settled up front. Write `docs/agents/specs/user-approval/`, following the
conventions of `docs/agents/specs.md` (one file per concern, a "Required tests" section at the
end of each file, decisions rather than code):

| File | Content | Read by |
|---|---|---|
| `README.md` | Overview, scope, product decision (#389), what `KERGHAN_USER_APPROVAL_REQUIRED` means, file index, sub-issue map (#391–#394) | all |
| `model.md` | `status` column and transitions, mandatory `approved` backfill, registration status driven by the flag, default user / demo seeds always `approved` | #392 |
| `security.md` | `sid` claim, `JwtGuard` session lookup, `request.user` built from the DB, `sid`-less tokens rejected, the explicit exceptions, non-disclosure rules (denied looks like logged out) | #391, #392 |
| `api.md` | Login, register, `status.json`, refresh, recover / reset, poll; admin search filter, approve, deny; error codes, `admin_denied`, cache policy | #392 (user endpoints), #393 (admin endpoints) |
| `ui.md` | Awaiting-approval view, re-check behavior, denied login message; admin page status filter and approve / deny actions | #392 (user side), #393 (admin side) |

- Add the feature to "Active specs" in `docs/agents/specs.md`.
- The env var is defined in `README.md` (with a pointer from `model.md`); its
  `environment-variables.md` row is added by #392, which starts consuming it.
- Define the testing strategy in each file's "Required tests" section.
- Consult the product-owner, security and data-access agents while writing them.

### Access tokens minted before the deploy

**Decision: `JwtGuard` rejects any access token without a `sid` claim with `401`.** No legacy
code path.

- This does not log anyone out: the session is the refresh-token row, which the deploy does not
  touch. On a `401`, the frontend's `ApiClient` already refreshes (`POST /auth/refresh.json`)
  and retries the request once (`frontend/assets/js/client/ApiClient.js`), and the refresh mints
  a `sid`-bearing access token for the same session. Device-authorization sessions use the same
  cookies and refresh flow.
- Only a client that never refreshes on `401` would see a single `401` after the deploy.
- Rejected alternative: accepting `sid`-less tokens with a user-id-only lookup until they expire
  — a temporary second path to remove later, which would also let those tokens bypass the
  session-revocation check for up to one access-token TTL, for no user-visible benefit.

### `isAdmin` and `username` read fresh from the DB

**Decision: after the session check, `JwtGuard` builds `request.user` (`{ sub, sid, username,
isAdmin }`) from the user row joined by the `sid` lookup, not from the JWT claims.**

- No extra query: the session lookup already joins the user.
- `AdminGuard` and `@CurrentUser()` stay unchanged and always see current values, so an admin
  demotion (today only possible through the default-user boot sync driven by
  `KERGHAN_DEFAULT_USER_ADMIN`, or a manual DB change) and a username change take effect on the
  next request instead of after the access-token TTL.
- The JWT keeps carrying `username` and `isAdmin` (nothing breaks), but they are no longer
  trusted for authorization. Slimming the payload to `{ sub, sid }` is a possible later cleanup,
  out of scope here.

### Revoked reason and error codes

Follow Kerghan's conventions, not Majora's shapes: every error body is
`{ error: { code, message, details? }, statusCode, timestamp }`
(`backend/src/core/http-exception.filter.ts`), specific codes are new `ErrorCodes` entries
(`backend/src/core/error-codes.ts`), and revoked reasons are `RevokedReason` values.

- **Revoked reason:** new `RevokedReason.ADMIN_DENIED = 'admin_denied'`, set on every refresh
  token revoked by deny (not `rotated`, so it never triggers replay detection).
- **Admin endpoints:**

  | Case | Response |
  |---|---|
  | Caller is not an admin | existing `AdminGuard` → `403 FORBIDDEN` |
  | Unknown `:id` | `404 NOT_FOUND` |
  | Invalid `status` filter on `search.json` | `400 VALIDATION_FAILED` (`@IsIn` on `SearchUsersDto`, existing `ValidationPipe` path) |
  | Approve a user who is not `pending` | `422 USER_NOT_PENDING` (new) |
  | Deny one's own account | `422 CANNOT_DENY_SELF` (new) |
  | Deny the default user | `409 DEFAULT_USER_MANAGED` (existing) |

- **Login:** `403 USER_DENIED` (new), returned **only after the password is verified** — a wrong
  password keeps the existing `401`, so the denied status cannot be probed without the password.
  A `pending` user gets the normal `200` with a session, blocked by the gate.
- **Device authorization:** `POST /auth/authorization-requests/:uuid/authorize.json` is
  authenticated, so the gate already answers a non-approved user with `401` before the endpoint
  runs — no new code there (and the endpoint keeps its convention of reporting every business
  rejection as `400`, never `401`/`403`). `poll.json` must **re-check the user's status** before
  minting a session, so a user denied between `authorize` and `poll` never receives one.

### `POST /auth/status.json` contract

Extends the existing contract (`docs/agents/backend/routes/auth.md`, `{ loggedIn, isAdmin }`,
always `201`, `@CachePolicy(CacheClass.Never)`):

| Caller | Body | Session cookies |
|---|---|---|
| Active session, user `approved` | `{ loggedIn: true, isAdmin }` (unchanged) | unchanged |
| Active session, user `pending` | `{ loggedIn: false, isAdmin: false, status: "pending" }` | **kept** — the session must survive to pick up approval without a new login |
| Active session, user `denied` (should not happen: deny revokes every session) | byte-for-byte the unauthenticated response | cleared |
| No valid session (including a denied user, whose sessions were revoked) | existing flow: automatic login when enabled and the IP is allowed, otherwise `{ loggedIn: false, isAdmin: false }` | as today |

- `status` appears **only** for `pending`; logged-out and denied stay byte-for-byte the
  unauthenticated response, so nothing reveals that an account is denied.
- Automatic-login precedence is unchanged ("a valid refresh cookie wins, whoever its user is"):
  a pending user's own session wins over automatic login; a denied user has no valid session
  left, so automatic login applies as for any visitor.
- `POST /auth/refresh.json` keeps rotating a pending user's session normally, so it stays alive
  and becomes usable the moment the user is approved; the access tokens it mints are blocked by
  the gate meanwhile.

### Frontend "awaiting approval" experience

- **Auth state gains `pending`**, set from `status.json`'s `status: "pending"` and carried on the
  `AuthEvents` bus next to `loggedIn` / `isAdmin`.
- **After register and login, the frontend re-checks `status.json`** instead of assuming a
  logged-in state (today `RegisterController` emits logged-in and redirects home). Register and
  login responses are unchanged; the status has a single source.
- **A full-page "Awaiting approval" view replaces the app content while pending**, with a short
  message and "Check again" / "Log out" actions; the header shows no logged-in menu.
- **Picking up the approval:** re-check `status.json` on window focus and on "Check again". No
  timer polling (`status.json` is never cached and hits the DB).
- **Login with a denied account:** `403 USER_DENIED` shows an explicit message in the login
  modal (e.g. "This account has been denied access."), only ever reached after a correct
  password.

### Out of scope

Any code change. Sub-issues of #389 implement against these specs.

## Benefits

- A single source of truth for a security-sensitive, cross-cutting feature.
- Implementation sub-issues stay small and consistent, and reviews can check them against the
  specs.
- Follows the proven specs lifecycle already used for integrations, standalone and the default
  user.
