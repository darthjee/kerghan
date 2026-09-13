# Plan: My Account: add page to edit username, email, and password

Issue: [88-my-account--add-page-to-edit-username--email--and-password.md](../../issues/88-my-account--add-page-to-edit-username--email--and-password.md)

## Overview

Add a self-service **My Account** page: a new authenticated `PATCH /auth/account.json` backend
endpoint that lets a logged-in user update their `username`, `email`, and/or `password` (always
confirmed by their current password), plus a new frontend page under `#/account/my-account`
reachable from the "My account" header dropdown. Brute-force lockout protection on
`currentPassword` attempts is explicitly out of scope (tracked in #91), as is revoking other active
sessions on password change (deliberately not done, unlike the recovery-email flow).

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

**`PATCH /auth/account.json`** — authenticated (rejects unauthenticated requests via the existing
JWT guard; no `@Public()`), identifies the user from the access-token session (`req.user.sub`),
sets `X-Skip-Cache: true` on the response.

Request body (JSON):
```json
{
  "currentPassword": "string, required",
  "username": "string, optional",
  "email": "string, optional",
  "newPassword": "string, optional, min length 8"
}
```
- At least one of `username`, `email`, `newPassword` must be present (validated service-side).
- No `newPasswordConfirmation` field is sent to the backend — the password/confirmation match is
  a client-side-only check, mirroring `RegisterDto`/`ResetPasswordDto`, which have no confirmation
  field either.

Response body on success (200):
```json
{ "username": "string", "email": "string" }
```
The frontend page updates its own local state from this response — no token refresh, no forced
re-login, no session revocation.

Error responses (standard NestJS `{statusCode, message, error}` shape):
- `401` — unauthenticated (handled by the existing JWT guard, no custom body needed).
- `400` — wrong `currentPassword` (message: `"Invalid current password"`), or DTO validation
  failure (missing all three optional fields, malformed email, password under 8 chars).
- `400` — duplicate `username` (message: `"Username already in use"`) or duplicate `email`
  (message: `"Email already in use"`) — mirrors the exception type already used by
  `AuthService#assertAvailable` during registration (`BadRequestException`), not a raw DB/500
  error.

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`) and
  `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`) and
  `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
