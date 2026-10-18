# Issue: Admin review: approve and deny new users (backend + frontend)

## Description

Fourth sub-issue of the user approval Epic (#389). Give admins the tools to review
registrations, backend and frontend, as defined in `docs/agents/specs/user-approval/`
(`api.md` → *Admin endpoints*, `ui.md` → *Admin side*). Relies on the `status` column, the
`approved` gate requirement and the `USER_DENIED` / revoked-reason groundwork from #392 (closed).

The admin review tools are **always available**, whatever `KERGHAN_USER_APPROVAL_REQUIRED` says.

## Problem

With approval required, newly registered users stay `pending` forever: no endpoint changes a
user's `status`, and admins cannot see who is waiting. Admins also have no way to reject a
registration or ban an existing account.

## Expected Behavior

### Backend (`AdminController` / `AdminService`)

Same conventions as the existing admin routes: default `JwtGuard` + `@AdminOnly()`,
`@CachePolicy(CacheClass.Never)`, thin controller, all status rules in `AdminService`.

- **User item shape:** every admin user item gains `status`:
  `{ id, username, email, isAdmin, createdAt, status }` — never secrets.
- **`POST /admin/users/search.json`:** body `{ q?, status? }`. `status` optional, one of
  `pending` | `approved` | `denied` (`@IsIn` on `SearchUsersDto`); anything else →
  `400 VALIDATION_FAILED`. Combined with `q` as AND; absent → every status. Still unpaginated.
- **`POST /admin/users/:id/approve.json`:** non-admin → `403`; unknown → `404 NOT_FOUND`;
  not `pending` → `422 USER_NOT_PENDING` (new code), nothing changes; success →
  `200 { user }` with status `approved`. Sessions untouched, so the pending session works on
  its next request.
- **`POST /admin/users/:id/deny.json`**, checks in order: non-admin → `403`; unknown → `404`;
  default user (while the default-user feature is on, via
  `DefaultUserService#assertNotDefaultUser`) → `409 DEFAULT_USER_MANAGED`; the caller's own
  id → `422 CANNOT_DENY_SELF` (new code); otherwise `200 { user }` with status `denied`, **from
  any status** (denying a denied user is a no-op on status). On success every **active** refresh
  token of the user is revoked via `TokenService#revokeUserTokens(userId, ADMIN_DENIED)`;
  already-revoked rows keep their reason. Other admins can be denied (decision #389).
- **Other admin routes** (`edit.json`, `recovery-link.json`, `send-recovery-email.json`):
  unchanged for every status and never change `status`.

### Frontend (existing admin users page, `frontend/assets/js/components/resources/admin/`)

- **Status filter** sent as `status` to `search.json`, with an "all" option and a **pending**
  view, combinable with the search box (`q`). The page opens on **"all"** (today's behavior);
  admins switch to "pending" for the review queue.
- Each user's **status** shown in the listing.
- **Approve** shown only for `pending` users.
- **Deny** (reject / ban) behind a **confirmation**, since it is final and logs the user out
  everywhere.
- No action where the API would refuse it: no deny on the admin's own row, no approve on a
  non-pending user, no action on a `denied` user. Deny stays offered on the default user's
  row (no default-user marker in the item) and its `409` message is shown.
- `422 USER_NOT_PENDING`, `422 CANNOT_DENY_SELF` and `409 DEFAULT_USER_MANAGED` show their
  `error.message`; after any action the listing reflects the new status.

### Cache

The `cache` agent confirms none of the new or changed routes belongs in `navi/resources/*.yml`
and that every one sends `X-Skip-Cache: true`.

## Solution

Implement following the "Required tests" of `api.md` (Search, Approve, Deny, Other admin routes,
Cache policy) and `ui.md` (Admin filter, Admin actions):

- **backend:** `SearchUsersDto.status`, `status` in the admin user serializer, `approve` / `deny`
  in `AdminService` + routes in `AdminController`, new `ErrorCodes` (`USER_NOT_PENDING`,
  `CANNOT_DENY_SELF`), deny revocation with `ADMIN_DENIED`, Jest specs; route docs in
  `docs/agents/backend/routes/`.
- **frontend:** filter, status column, approve / deny actions with confirmation and error
  display, Jasmine specs.
- **cache:** Navi review (read-only unless a change is needed).

## Out of scope

- Pagination of the admin user listing (separate issue).
- Notifications (approve / deny send nothing; admins are not alerted of pending users).
- Un-deny: `denied` is final.
- Folding the specs into the permanent docs (#394).

## Benefits

Completes the approval loop: pending users can actually be let in, and admins can reject
registrations or ban accounts, with immediate logout on deny.
