# Document the device-authorization flow in modules/auth.md

`docs/agents/modules/auth.md` is the canonical per-module reference for Auth. It currently
documents only the classic login/register/refresh/logoff/status routes, the three original
entities, and the JWT/refresh-token flow. Extend it with the device-authorization flow, following
the same narrative style already used for "JWT/refresh-token flow" and the `user.registered`/
`password-recovery.requested` event sections.

Ground truth to document (read the source files, don't guess):

- **Entity** — `backend/src/auth/entities/authorization-request.entity.ts`: table
  `auth_authorization_requests`, status enum `'open' | 'approved' | 'denied' | 'logged' |
  'expired'`, `userId` logical FK (`NULL` when the username didn't resolve — such a row can never
  be approved), only the SHA-256 hash of the poll token is persisted, `requestIp`/
  `requestUserAgent` captured at creation, `approvedByUserId`, `expiresAt`/`resolvedAt`/
  `loggedAt`, and the `authorizeFailedAttempts`/`authorizeLockedUntil` hardening columns.
- **The five endpoints** (`backend/src/auth/authorization-request.controller.ts`), as a compact
  table in the same shape as the existing "Routes" table (Route | Body | Response), linking to
  `docs/agents/backend/routes/auth.md` for the full per-endpoint reference (added in step 03):
  - `POST /auth/authorization-requests.json` — `@Public()`. `{ username }` → `{ uuid, pollToken,
    expiresAt }`. Enumeration-safe: identical response whether or not the username resolves.
  - `POST /auth/authorization-requests/:uuid/poll.json` — `@Public()`. `{ pollToken }` → `{
    status }`, plus `user`/`refreshToken` + the `access_token` cookie on the winning `approved`
    poll (identical session shape to password login).
  - `POST /auth/authorization-requests/mine.json` — authenticated (default `JwtGuard`). Lists the
    caller's own open, non-expired requests.
  - `POST /auth/authorization-requests/:uuid/authorize.json` — authenticated. Re-verifies the
    approver's current password; every business rejection is a `400`, never `401`/`403` (so
    `ApiClient`'s refresh-and-retry isn't triggered by a business rejection).
  - `POST /auth/authorization-requests/:uuid/deny.json` — authenticated, same rejection-shape
    rule, no password required.
- **Status machine**: `open → approved → logged` (the winning poll's atomic claim — document that
  `approved → logged` is a single atomic transition so only one poller can ever win), plus
  `open → denied` and `open → expired` (lazy expiry + the abuse-guard's open-cap eviction from
  step 8, cross-reference the hardening limits below).
- **Poll-token contract**: plaintext returned once from `create`, never stored (only its SHA-256
  hash persisted) — mirror how the existing doc already describes refresh-token hashing for
  consistency.
- **Enumeration safety**: `create` always responds identically regardless of whether `username`
  resolves to a real user (cross-reference `AuthorizationRequestAbuseGuardService`'s comment about
  always computing both IP and username counts, never short-circuiting, for the same reason).
- **Hardening limits** (`backend/src/auth/authorization-request-abuse-guard.service.ts`): the
  per-IP/per-username `create` rate limit + sliding window, the concurrent-open-requests-per-user
  cap (oldest eviction, never rejects), and the `authorize` wrong-password cool-off lockout —
  name each config key and default (full table goes in `docs/agents/environment-variables.md`,
  step 05; here just narrate what each limit does and reference that doc for exact values).
- **Login modal as the single entry point**: note that standalone login/register pages have been
  replaced by `LoginModal` (`frontend/assets/js/components/common/loginModal/LoginModal.jsx`) —
  keep this note brief; full frontend detail belongs in
  `docs/agents/architecture/frontend.md` (step 01), not duplicated here.

## Files to Change

- `docs/agents/modules/auth.md` — add a new "Device-authorization flow" section (entity, routes
  table, status machine, poll-token contract, enumeration safety, hardening limits, login-modal
  note) in the same place/style as the existing "JWT/refresh-token flow" section; also add
  `auth_authorization_requests` to the existing "Entities" section's bullet list.
