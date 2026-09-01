# Issue: Implement password recovery flow

## Description
A self-service password recovery flow: a `recover.json` endpoint that a logged-out user hits with
their email, and a `reset-password.json` endpoint that finishes the flow with a token and a new
password — plus the two frontend pages that drive them. Adapted from a reference implementation
(a Django-based recovery flow from another codebase) into this codebase's existing NestJS `auth`
module and React `accounts` page conventions.

Surfaced while enhancing #35 (header/page reacting to login/logoff): that issue added a
placeholder "Recover" link to the header (logged-out only, alongside Login/Register), pointing at
a route (`#/recover`) that doesn't resolve to anything yet. This issue builds the real feature
behind that link.

## Problem
Kerghan has no way for a user who forgets their password to regain access on their own — the only
options today are `login`/`register`/`refresh`/`logoff`. There's also no outbound email
infrastructure of any kind (no mailer dependency, no SMTP config; the only precedent is
`UserRegisteredEvent`, which fires on registration but has no listener).

## Expected Behavior
1. A logged-out user visits `#/recover`, enters their email, and submits. The backend always
   responds `200 { sent: true }`, whether or not the email matches an account — no status, body,
   or timing difference should reveal whether the email is registered.
2. If the email matches an account, a single-use, time-limited `PasswordResetToken` is created and
   a `PasswordRecoveryRequestedEvent` is fired (consumed by a later issue — see "Email delivery"
   below). If it doesn't match, nothing happens beyond the same `200` response.
3. The user follows the link from their recovery email to `#/recover-password?token=...`, sets a
   new password, and submits to `reset-password.json`.
4. Any rejection reason (unknown token, already-used token, expired token) produces the exact same
   generic `400 Bad Request` error — the client never learns which case it hit.
5. On success, the password is updated, the token is marked used (can't be replayed), all of that
   user's existing refresh tokens/sessions are revoked (forcing re-login everywhere), and the user
   sees a confirmation screen with a manual link back to `#/login`.

## Solution

### Route naming & controller placement
`auth.module.ts` currently follows a one-controller-per-module pattern: a single `AuthController`
and `AuthService` manage multiple entities (`User`, `RefreshToken`, `Session`) — there's no
precedent for splitting concerns into per-entity controllers within the module. This issue keeps
that pattern:

- Add `recover.json` and `reset-password.json` as two new `@Public()` `POST` routes on the
  existing `AuthController`, with the logic living in `AuthService` (or a private helper it
  delegates to), matching how `login`/`register`/`refresh`/`logoff` are already organized.
- Add a new `PasswordResetToken` entity in `backend/src/auth/entities/`, registered in
  `auth.module.ts`'s `TypeOrmModule.forFeature([...])` alongside `User`, `RefreshToken`, `Session`
  — no new module, no new controller.
- Route names: `POST /auth/recover.json` and `POST /auth/reset-password.json` — flat, no path
  nesting (consistent with `login.json`/`register.json`/`refresh.json`).

### Email delivery
Rather than block this issue on building outbound email infrastructure from scratch, email
sending is split out entirely:

- **This issue's scope**: `recover.json` creates the `PasswordResetToken` row (when the email
  matches an account) and fires an event — e.g. `PasswordRecoveryRequestedEvent(userId, token,
  resetUrl)` via `EventEmitter2` — mirroring the existing `UserRegisteredEvent` pattern exactly:
  fire-and-forget, no listener defined here.
- **#38** — configure general-purpose outbound email infrastructure (mailer dependency, env
  config, a `MailService`). Independent of this issue; general-purpose foundation.
- **#39** (sub-issue of this one) — add the listener that consumes
  `PasswordRecoveryRequestedEvent` and actually sends the recovery email, once #38 exists.

Digging into this also surfaced that the reference implementation has a staff-only "generate a
recovery link for a user" tool sharing the same token model — out of scope for this self-service
issue, but worth building separately:

- **#40** — add an admin role/permission concept to `User` (foundational, no admin UI yet).
- **#41** — the admin tool: look up users, view/regenerate their recovery link, and force-send the
  recovery email on demand. Depends on #40, on this issue's `PasswordResetToken` model, and on
  #39's email-sending capability.

### Token model & storage
`RefreshToken` (`backend/src/auth/entities/refresh-token.entity.ts`) is already almost exactly
this model — `PasswordResetToken` mirrors it closely rather than inventing a new pattern:

- Table `auth_password_reset_tokens`. Columns: `id`, `token_hash` (unique-indexed), `user_id`
  (logical FK into `auth_users`, no physical FK — same convention as `RefreshToken`/`Session`),
  `created_at` (`@CreateDateColumn`), `expires_at`, and `used_at` (nullable `datetime` — the
  single-use counterpart to `RefreshToken`'s `revokedAt`).
- Token generation/storage: identical to `RefreshToken`'s existing pattern —
  `randomBytes(48).toString('hex')` for the plaintext value, only its SHA-256 hash
  (`createHash('sha256').update(token).digest('hex')`) persisted. The plaintext is embedded once
  in the recovery-email link (via the event payload consumed by #39) and never stored.
- Validity check mirrors `RefreshToken`'s: `!usedAt && expiresAt > new Date()`.
- Expiration window: configurable via `KERGHAN_PASSWORD_RESET_TOKEN_TTL_MS`
  (`ConfigService.get(..., DEFAULT_PASSWORD_RESET_TOKEN_TTL_MS)`), default 30 minutes.

### Enumeration-safety & uniform-error contract
- `recover.json` always responds `200 { sent: true }`. The user lookup happens regardless of
  match (no branch-dependent early return); the `PasswordResetToken` row and the
  `PasswordRecoveryRequestedEvent` are only created/fired when the email matches an account.
- `reset-password.json`: every rejection reason (unknown token, already-used token, expired token)
  throws the exact same `BadRequestException('Invalid or expired token')` — **`400`, not `401`**.
  This corrects an earlier draft of this issue, which proposed `401` to mirror `refresh.json`'s
  own uniform-error pattern (`auth.service.ts`, which collapses unknown/expired/revoked refresh
  tokens into one `UnauthorizedException`). That precedent doesn't transfer here: the frontend's
  shared `ApiClient#sendJson` (`frontend/assets/js/client/ApiClient.js`) intercepts **every** `401`
  app-wide to attempt an access-token refresh-and-retry — appropriate for `refresh.json`'s
  authenticated context, but wrong for a logged-out flow like this one. A `401` here would have a
  user with no stored refresh token silently redirected to `/login` (via `#sessionExpired()`)
  instead of seeing "Invalid or expired token" — and could even resolve as a false success in a
  naively-written `AccountsClient.resetPassword`, since `ApiClient` resolves to `undefined` rather
  than throwing in that path. `400` bypasses that interception entirely and reaches the plain
  `throw new ApiError(response.status, data.error)` branch instead. No custom exception filter is
  added — Nest's default error shape is used as-is.
- Password-format validation (e.g. `@MinLength(8)`, matching `RegisterDto`) stays a normal
  `class-validator`/`ValidationPipe` 400 too — same status as the uniform token error, which is
  fine: both are non-401 `ApiError`s the frontend surfaces the same way, and neither leaks which
  reset-rejection reason occurred.
- No account-eligibility/banned-state concept exists in Kerghan today (confirmed against
  `docs/agents/product.md`), so there's nothing to check at reset time beyond token validity.
- Separately: exploring this surfaced that `ApiClient`'s `throw new ApiError(response.status,
  data.error)` reads a `data.error` field, but NestJS's default (unfiltered) exception body shape
  is `{ statusCode, message, error }`, where `error` is just the generic HTTP status text (e.g.
  "Bad Request") and the actual message lives in `data.message`. This looks like a pre-existing
  mismatch affecting other flows too (e.g. `register.json`'s "username is not available") — tracked
  separately as #42, not fixed here, since it's a cross-cutting frontend/backend contract issue
  unrelated to password recovery specifically. It doesn't undermine this issue's security
  properties (the displayed text stays uniform across rejection reasons either way), only its
  wording.

### Frontend pages & routing
Follows the existing `Login`/`Register` page conventions
(`frontend/assets/js/components/resources/accounts/pages/`): a page component +
`controllers/<Name>Controller.js` + `helpers/<Name>Helper.jsx` per page.

- **`Recover.jsx`**: a single email field, mirroring `Login.jsx`. On submit, calls
  `AccountsClient.recover(email)` and always flips to a generic "check your email" confirmation
  state in a `finally` block — including on network/server errors, so a real outage looks
  identical to success to the end user, by design (the enumeration-safety contract carried into
  the UI layer).
- **`ResetPassword.jsx`**: reads `token` from the current hash's query string
  (`#/recover-password?token=...`) — a one-off parse local to this page/controller. Renders
  new-password + confirm-password fields, client-side-validated the same way
  `RegisterController#validate`/`#validatePasswordConfirmation` already does (equality check is a
  UX convenience only; the server remains the source of truth). On success, shows a confirmation
  screen with a manual link back to `#/login` (no auto-redirect). On failure, shows the server's
  generic error message as a submit-error alert.
- **`AccountsClient`** gains two methods, neither touching `AuthSession` (these flows never issue
  a refresh token): `recover(email)` → `POST /auth/recover.json { email }`, and
  `resetPassword({ token, password, passwordConfirmation })` →
  `POST /auth/reset-password.json { token, password, password_confirmation }`.
- **Routing**: register `/recover` → `'recover'` and `/recover-password` → `'reset-password'` in
  `HashRouteResolver.js`'s `ROUTES` table (before the catch-all `/`), and add both page keys to
  `AppHelper.jsx`'s `PAGES` map. `/recover` already matches the placeholder header link added in
  #35 — no header change needed beyond the route now resolving correctly.

### Scope boundaries

**In scope:**
- Backend: `recover.json` + `reset-password.json`, the `PasswordResetToken` entity/migration, and
  the `PasswordRecoveryRequestedEvent` (fired, unconsumed).
- On a successful reset, revoke all of that user's existing refresh tokens via `AuthService`'s
  existing `#revokeTokenFamily(userId)` (currently only used for refresh-token replay detection).
- Frontend: `Recover`/`ResetPassword` pages, their controllers/helpers, `AccountsClient` methods,
  and the two new hash routes. Neither page is guarded against already-logged-in access —
  consistent with `Login`/`Register`, which have no such guard today either.

**Out of scope (split into separate, already-created issues):**
- Actual email sending — #38 (mail infrastructure) and #39 (the recovery-email listener).
- Admin/staff-generated recovery links and the admin lookup tool — #40 and #41.
- Any account-eligibility/banned-state check at reset time — no such concept exists yet.
- Rate limiting/abuse prevention on `recover.json` — left for implementation to size, following
  existing codebase conventions if any rate-limiting precedent exists; not otherwise specified.

## Benefits
- Users who forget their password can regain access without manual/admin intervention.
- Reuses this codebase's own established security precedents (the `RefreshToken` model, and
  `refresh.json`'s "collapse every rejection reason into one message" pattern) instead of
  inventing new ones, keeping the auth module internally consistent.
- Fully closes out the placeholder "Recover" link added in #35.
- Establishes the `PasswordResetToken` model and `PasswordRecoveryRequestedEvent` that the
  follow-on admin tooling (#40, #41) and email-sending work (#38, #39) build directly on.
