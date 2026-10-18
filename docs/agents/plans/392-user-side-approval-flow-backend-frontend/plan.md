# Plan: User-side approval flow (backend + frontend)

Issue: [392-user-side-approval-flow-backend-frontend.md](../../issues/392-user-side-approval-flow-backend-frontend.md)

## Overview

Add `auth_users.status` (`pending` | `approved` | `denied`) with an `approved` backfill, the
`KERGHAN_USER_APPROVAL_REQUIRED` flag driving the status of new registrations, and rule 3 of the
`JwtGuard` session gate (the user must be `approved`, always). The status-aware auth endpoints
(login, status, refresh, recover, reset, device-authorization poll) follow
`docs/agents/specs/user-approval/api.md`. The frontend gains a `pending` auth state, a re-check of
`status.json` after register / login, a full-page awaiting-approval view and the denied-login
message. Standalone passes the flag through. The cache agent confirms the cache policy.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)
- [standalone](standalone.md)
- [cache](cache.md)

## Shared contracts

**Status values** (`backend/src/auth/entities/user.entity.ts`, exported const + type, like
`RevokedReason`): `UserStatus = { PENDING: 'pending', APPROVED: 'approved', DENIED: 'denied' }`.
Never exposed in the auth endpoints' `user` payloads (`{ id, username, email, isAdmin }`
unchanged).

**Flag:** `KERGHAN_USER_APPROVAL_REQUIRED`: optional; on only when exactly `'true'` (same rule as
`KERGHAN_EMAILS_ENABLED` / `KERGHAN_DEFAULT_USER_*`); unset or any other value → off. Off → new
registrations `approved`; on → `pending`.

**`POST /auth/status.json`** (always `201`, `CacheClass.Never`):

| Caller | Body | Cookies |
|---|---|---|
| Active session, `approved` | `{ loggedIn: true, isAdmin }` | unchanged |
| Active session, `pending` | `{ loggedIn: false, isAdmin: false, status: "pending" }` | **kept** (not cleared) |
| Active session, `denied` | byte-for-byte the anonymous answer (automatic-login flow applies) | cleared unless automatic login sets new ones |
| No valid session | `{ loggedIn: false, isAdmin: false }` or automatic login, as today | as today |

`status` is present **only** for `pending`.

**`POST /auth/login.json`:** correct password on a `denied` user → `403`, body
`{ error: { code: "USER_DENIED", message: "This account has been denied access" }, statusCode: 403, timestamp }`,
no cookies. Wrong password → the existing `401` whatever the status. `pending` → normal `200 { user }`
with session cookies.

**`POST /auth/register.json`:** response and cookies unchanged for every status.

**`DELETE /auth/logoff.json`:** unchanged; usable by a pending user (it is how the awaiting view
logs out). It is already `@Public()`, so it works for a pending session.

**Standalone:** `KERGHAN_USER_APPROVAL_REQUIRED` is listed by name in the `kerghan` service's
`environment:` (`standalone/vault/docker-compose.yml`), never written by the client.

## Notes

- Order: backend first (frontend relies on the `status.json` / `login.json` contract above; its
  specs mock `AccountsClient`, so the two can proceed in parallel against the contract).
- The fold-in of these rules into permanent docs (`modules/auth.md`, `backend/routes/auth.md`,
  `product.md`, default-user managed-field lists) is #394, not this issue. Only
  `environment-variables.md` is updated here (the specs assign the flag's row to #392).
