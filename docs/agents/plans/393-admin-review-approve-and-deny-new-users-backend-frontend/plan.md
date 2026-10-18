# Plan: Admin review: approve and deny new users (backend + frontend)

Issue: [393-admin-review-approve-and-deny-new-users-backend-frontend.md](../../issues/393-admin-review-approve-and-deny-new-users-backend-frontend.md)

## Overview

Add the admin half of the user-approval feature (#389), as defined in
`docs/agents/specs/user-approval/api.md` (*Admin endpoints*) and `ui.md` (*Admin side*). The
backend gains a `status` filter and `status` field on `search.json` plus `approve.json` and
`deny.json` in `AdminController` / `AdminService`. The frontend admin users page gains a status
filter, a status column, and approve / deny actions. The cache agent confirms nothing needs Navi
warm-up.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)
- [cache](cache.md)

## Shared contracts

All routes: `@AdminOnly()`, `@CachePolicy(CacheClass.Never)` (controller level, already in place),
so `X-Skip-Cache: true` + `Cache-Control: no-store`. Error body is the standard
`{ error: { code, message, details? }, statusCode, timestamp }`.

**Admin user item** (search items and the `user` of approve / deny responses):

```text
{ id: number, username: string, email: string, isAdmin: boolean, createdAt: string,
  status: 'pending' | 'approved' | 'denied' }
```

**`POST /admin/users/search.json`**

- Body: `{ q?: string, status?: 'pending' | 'approved' | 'denied' }`; any other `status` →
  `400 VALIDATION_FAILED`. `q` and `status` combine with AND; absent `status` → every status.
- Response: `{ users: [<user item>], currentUserId: number }`.
- `currentUserId` is the calling admin's own id (`@CurrentUser().sub`). **Plan decision, not in
  the spec:** `status.json` exposes no user id and there is no account-read route, so without it
  the frontend cannot hide deny on the admin's own row, which `ui.md` requires. It is admin-only
  and reveals nothing the admin does not already know. The backend agent records it in
  `specs/user-approval/api.md` and `ui.md`.

**`POST /admin/users/:id/approve.json`** (body `{}`)

| Case | Response |
|---|---|
| Non-admin | `403 FORBIDDEN` (existing `AdminGuard`) |
| Unknown `:id` | `404 NOT_FOUND` |
| User not `pending` | `422` `error.code = "USER_NOT_PENDING"`, nothing changes |
| Success | `200 { user: <user item> }`, `status: "approved"` |

**`POST /admin/users/:id/deny.json`** (body `{}`), checks in this order:

| Case | Response |
|---|---|
| Non-admin | `403 FORBIDDEN` |
| Unknown `:id` | `404 NOT_FOUND` |
| Default user (feature on) | `409` `error.code = "DEFAULT_USER_MANAGED"`, nothing changes |
| `:id` is the caller | `422` `error.code = "CANNOT_DENY_SELF"`, nothing changes |
| Success, any status | `200 { user: <user item> }`, `status: "denied"` |

Frontend reads `error.message` for the `422` / `409` cases (through the existing `ApiError`).
