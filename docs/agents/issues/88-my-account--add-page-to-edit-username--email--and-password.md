# Issue: My Account: add page to edit username, email, and password

## Description

The header's "My account" dropdown (`frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`)
currently holds a single item, "Authorizations" — its docstring already anticipates future account
pages nesting under it. This issue adds the first of those: a **My Account** page where a logged-in
user can edit their own `username`, `email`, and `password`.

There is currently no backend endpoint for a user to update their own account — `AuthController`
only exposes `login`/`logoff`/`recover`/`refresh`/`register`/`reset-password`/`status`, all of
which are either public or session-establishing. This issue adds both the backend endpoint and the
frontend page in one pass.

## Problem

- Users have no way to change their `username`, `email`, or `password` once registered, short of
  the "forgot password" recovery flow.
- The "My account" dropdown has no page to hold this.

## Expected Behavior

- A new "Account" (or similarly named) link appears in the "My account" dropdown, alongside
  "Authorizations", routing to a new My Account page (e.g. `#/account/edit`).
- The page shows the current `username` and `email` in editable fields, plus a separate "change
  password" section (new password + confirmation).
- Saving `username` and/or `email` requires the user to re-enter their **current password** to
  confirm the change.
- Changing the password requires the **current password** plus the new password (`min length 8`,
  matching `RegisterDto`/`ResetPasswordDto`). Unlike the existing "forgot password" recovery flow,
  this self-service change does **not** revoke the user's other active sessions/refresh tokens —
  other logged-in devices keep working until their token naturally expires or refreshes.
- A duplicate `username` or `email` (unique constraints on `auth_users`) surfaces a clear inline
  error instead of a raw 500/DB error.
- An incorrect current password surfaces a clear inline error and makes no change.
- On success, the page confirms the update and immediately reflects the saved `username`/`email`
  from the response — no full re-login or forced token refresh is required. (Note: the access-token
  JWT itself embeds `username` and stays stale until its next natural refresh; this is acceptable
  because nothing in the app currently reads username/email from it — the header dropdown doesn't
  render either field today.)
- Repeated wrong `currentPassword` attempts are **not** rate-limited/locked out by this issue —
  that hardening (mirroring the authorization-request abuse guard from #66) is intentionally
  deferred to a follow-up issue, #91, to keep this issue focused on the core edit flow.

## Solution

### Scope

Backend + frontend together, single issue (no sub-issue split). Brute-force/lockout protection for
`currentPassword` attempts is out of scope here — tracked separately in #91.

**Backend**
- New endpoint, e.g. `PATCH /auth/account.json`, authenticated (not `@Public()`, unlike most of
  `AuthController`) — identifies the account via the existing access-token session, not a body
  param.
- Request DTO: `currentPassword` (required), plus optional `username`, `email`,
  `newPassword`/`newPasswordConfirmation` — at least one of `username`/`email`/`newPassword` must
  be present.
- Service verifies `currentPassword` against `passwordDigest` before applying any change; returns
  a clear conflict error on unique-constraint violation for `username`/`email`. Mirror
  `AuthService#register`'s existing `#assertAvailable` pre-check pattern (`findOne` lookup raising
  `BadRequestException` on collision, `backend/src/auth/auth.service.ts:72-73, 199-210`) rather
  than catching a raw DB unique-constraint error — consistent with how registration already
  handles this (including its known, currently-accepted TOCTOU race).
- No email-verification/confirmation step — the codebase has no such mechanism today (register and
  recovery both apply email/password changes immediately), so an unverified immediate `email`
  change is consistent with existing conventions.
- Password change does **not** call `#revokeTokenFamily` (unlike `resetPassword`) — other active
  sessions are deliberately left alone for this self-service flow (see Expected Behavior).
- Follow existing conventions: thin controller delegating to a service method (new method on
  `AuthService`, or a new dedicated service if that keeps `AuthService` within the complexity/line
  limits — architect/backend judgment call), `X-Skip-Cache` on the response, DTO validation via
  `class-validator` mirroring `RegisterDto`/`ResetPasswordDto`.

**Frontend**
- New page + route under `#/account/`, following the existing pattern in
  `frontend/assets/js/components/resources/accounts/pages/` (see
  `AuthorizationRequestsController.js` / `AuthorizationRequestsHelper.jsx`).
- New "Account" item added to `HeaderHelper.#renderMyAccountDropdown()`.
- Form fields for `username`, `email`, current password, and a separate password-change section;
  inline validation/error display for the failure cases above.
- After a successful save, update the page's own local state from the PATCH response so the
  displayed `username`/`email` reflect the change immediately — no token refresh or re-login flow
  needs to be triggered.

### Acceptance criteria

- [ ] `PATCH /auth/account.json` (or equivalent) requires an authenticated session and rejects an
      unauthenticated request.
- [ ] Updating `username` and/or `email` without the correct current password fails with a clear
      error and makes no change.
- [ ] Updating to a `username`/`email` already used by another account fails with a clear error
      (no raw DB/500 error).
- [ ] Changing the password requires the current password, validates the new password
      (`min length 8`), and results in the stored `passwordDigest` being updated, without revoking
      the user's other active sessions.
- [ ] The "My account" dropdown has a new item routing to the My Account page.
- [ ] The My Account page lets a logged-in user view/edit `username`/`email` and change their
      password, surfacing the error cases above inline, and reflects a successful save immediately
      from the response.
- [ ] New backend and frontend tests cover the success path and each failure case above.

## Benefits

- Lets users self-correct their own account details instead of contacting an admin or relying on
  the recovery-email flow for a simple username/email change.
- Fills in the first real item under "My account" beyond "Authorizations", as the dropdown's
  docstring already anticipated.
