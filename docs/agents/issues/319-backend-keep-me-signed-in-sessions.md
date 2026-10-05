# Issue: Backend: "Keep me signed in" sessions

## Description

Part of #318 — "Keep me signed in". This is the backend half of the option; the frontend checkbox
and approver indicator are a separate sub-issue (#320).

A login (password or device authorization) can opt into a long-lived, renewing session through a new
optional `keepSignedIn` flag, without changing the default behavior for anyone who doesn't opt in.

## Problem

Today a login mints a 15-minute access-token JWT (httpOnly cookie, `KERGHAN_ACCESS_TOKEN_TTL_MS`) and
a refresh token with a hardcoded 7-day TTL (`REFRESH_TOKEN_TTL_MS` in
`backend/src/auth/token.service.ts`), rotated on every `POST /auth/refresh.json`. The client stores
the refresh token in `localStorage`. Sessions therefore expire after 7 days of inactivity, and users
have no way to ask for a longer session. The refresh-token TTL is also not configurable.

## Expected Behavior

- `POST /auth/login.json` and the device authorization-request create
  (`POST /auth/authorization-requests.json`) accept an optional boolean `keepSignedIn`
  (default `false`). Register, password reset and refresh do not accept it.
- **Opted in:** the refresh token gets the persistent TTL (default 30 days). Every rotation issues a
  new token that is still `keepSignedIn` with a fresh persistent TTL, so an active user practically
  never gets logged out. No absolute cap.
- **Not opted in:** exactly today's behavior — regular TTL (default 7 days), renewed on rotation.
- **Device authorization:** the requesting device's choice is stored on the authorization request and
  applied when the approved request's winning poll mints the session. The approver's open-requests
  list exposes `keepSignedIn` so the approver sees it before approving; the approver can only approve
  or deny, never change the choice.
- Both TTLs are configurable through optional env vars; changes apply only to tokens minted
  afterwards.

### Unchanged behavior

- Session responses: `{ user, refreshToken }` for login, register, refresh and the device poll;
  `POST /auth/status.json` keeps returning `{ loggedIn, isAdmin }`. Whether a session is persistent
  is exposed later by the sessions list API (#322).
- Logout revokes only the presented token.
- Replay detection (presenting an already-revoked token revokes the user's whole token family)
  applies to `keepSignedIn` and regular tokens alike.
- A regular session cannot be upgraded in place; the user must log in again with the option.
- Login rate limiting / abuse guards are unchanged.

## Solution

### Request validation

`keepSignedIn` is a strict optional boolean (`@IsOptional() @IsBoolean()` on `LoginDto` and
`CreateAuthorizationRequestDto`): omitted → `false`; any non-boolean value (e.g. `"true"`, `1`) →
`400`.

### Persistence (additive migrations)

- `auth_refresh_tokens.keep_signed_in` boolean, default `false` (existing rows stay regular).
- `keep_signed_in` boolean on the authorization-requests table, default `false`.
- `down` drops the columns.

### Naming

One name end-to-end, following the snake_case column / camelCase property convention:

| Layer | Name |
|---|---|
| API request field / `OpenAuthorizationRequest` field | `keepSignedIn` |
| `auth_refresh_tokens` column / `RefreshToken` property | `keep_signed_in` / `keepSignedIn` |
| authorization-requests column / `AuthorizationRequest` property | `keep_signed_in` / `keepSignedIn` |

"Persistent" only appears in prose and in the env var / constant naming the long TTL.

### Token minting and rotation

- `TokenService#issueTokens` takes the `keepSignedIn` choice, stores it on the new `RefreshToken`
  row, and picks the persistent or regular TTL accordingly.
- `AuthService#login` passes the DTO's value; `AuthorizationRequestService`'s winning-poll claim
  passes the request's stored value; `register` passes `false`.
- `AuthService#refresh` passes the presented token row's `keepSignedIn` to the rotated token.
- `OpenAuthorizationRequest` gains `keepSignedIn: boolean` alongside `uuid`, `requestIp`,
  `requestUserAgent`, `createdAt` and `expiresAt`.

### Config wiring

- `TokenService` injects `ConfigService` and reads each TTL per call through the existing
  `getNumberConfig` helper (`backend/src/core/numeric-config.ts`), the same pattern as the abuse-guard
  services. Defaults are named constants — `DEFAULT_REFRESH_TOKEN_TTL_MS` (7 days) and
  `DEFAULT_PERSISTENT_REFRESH_TOKEN_TTL_MS` (30 days) — replacing the hardcoded
  `REFRESH_TOKEN_TTL_MS`.
- Env vars: `KERGHAN_REFRESH_TOKEN_TTL_MS` and `KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS`, both
  optional.
- **Invalid values:** unset or non-numeric → default (as `getNumberConfig` already does);
  **non-positive** (`0` or negative) → default plus a logged warning, at most once per key per process
  (the warning names the env var and the fallback, never token material). An invalid value never
  breaks boot.
- **No ordering check:** the two TTLs are independent; the docs state the persistent TTL is expected
  to be longer, but a shorter value is not rejected or clamped.

### Performance & security

- **Accepted risk:** the client keeps the refresh token in `localStorage` with no CSP, so an XSS bug
  could exfiltrate a renewing `keepSignedIn` token. Accepted here and documented; reducing that
  exposure (httpOnly cookie and/or CSP) is tracked in #324.
- **Row growth:** each login/refresh inserts `auth_refresh_tokens` and `auth_sessions` rows that are
  never pruned — pre-existing, slightly worsened by longer sessions, tracked in #325. Not addressed
  here.
- Refresh tokens are never logged.

### Docs

- `docs/agents/environment-variables.md`: both new env vars (defaults, fallback behavior, "applies to
  newly minted tokens only", persistent expected to be longer).
- `docs/agents/modules/auth.md`: `keepSignedIn` in the endpoint table (login, authorization-request
  create, open-requests list), the new `keep_signed_in` columns in the entity listings, and the
  "JWT/refresh-token flow" section (configurable 7-day/30-day TTLs, carry-over on rotation).
- `TokenService`/`AuthService` doc-comments updated (no more hardcoded "7-day TTL").

### Testing

Jest specs for:

- TTL selection (both env vars, their defaults, and the fallback + one-time warning for non-numeric
  and non-positive values);
- `keepSignedIn` carried over on refresh;
- `keepSignedIn` on password login and through device-auth create → approve → poll;
- register always minting a regular token;
- the migrations;
- the `OpenAuthorizationRequest` field;
- DTO validation (omitted → `false`, non-boolean → `400`).

### Agents

backend; data-access review (new response field); cache review (no cache-policy regressions on the
touched endpoints).

## Benefits

- Users who opt in stay logged in while they keep using the app, instead of being logged out after 7
  idle days.
- Default behavior and existing sessions are untouched; the change is purely additive.
- Both refresh-token lifetimes become operator-configurable.
