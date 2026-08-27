# Routes — Auth

Authentication and session management routes, served by `AuthController`
under the `/auth` prefix (`auth/auth.controller.ts`). All routes are
`@Public()` — they exist to establish or renew credentials, so they must
be reachable without an already-valid access token.

Business logic lives in `AuthService` (`auth/auth.service.ts`); the
controller is a thin delegation layer.

## Endpoints

### `POST /auth/login.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `LoginDto` — `{ username: string, password: string }` |
| Success response | `{ user, refreshToken }` + sets `access_token` cookie |
| HTTP status | `200` (default) |

`user` is `{ id, username, email }` — `passwordDigest` is never serialized.

### `POST /auth/register.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `RegisterDto` — `{ username, password, email }` |
| Success response | `{ user, refreshToken }` + sets `access_token` cookie |
| HTTP status | `200` (default) |

Creates a new `auth_users` record, then issues tokens identically to login.

### `POST /auth/refresh.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `RefreshTokenDto` — `{ refreshToken: string }` |
| Success response | `{ user, refreshToken }` + sets new `access_token` cookie |
| HTTP status | `200` (default) |

Rotates the refresh token server-side (old token's `revokedAt` is set).
Replay of a revoked or expired token is rejected with `401`.

### `DELETE /auth/logoff.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `RefreshTokenDto` — `{ refreshToken: string }` |
| Success response | No body |
| HTTP status | `204 No Content` |

Revokes the refresh token server-side and clears the `access_token` cookie.

## Shared behavior

All four routes set `X-Skip-Cache: true` on the response. Tent's
`default_proxy` rule caches any 2xx `*.json` response keyed only by query
string, regardless of HTTP method — since these POST routes carry no
query string, an uncapped response could otherwise be cached after the
first login/register/refresh and served verbatim (credentials included)
to a different caller.

See `docs/agents/architecture/proxy.md`'s "Cache bypass (`X-Skip-Cache`)"
section for the general convention.

## Access token cookie

The `access_token` cookie is set with:
- `httpOnly: true` — not accessible via JavaScript
- `secure: true` — only sent over HTTPS
- `sameSite: 'strict'` — not sent on cross-site requests
- `maxAge`: `KERGHAN_ACCESS_TOKEN_TTL_MS` (default 15 minutes when unset — matches JWT expiry;
  see `docs/agents/environment-variables.md`)

The token is never returned in the response body — only the `refreshToken`
is, as it must be stored client-side to call `/auth/refresh.json` and
`/auth/logoff.json`.

## Source files

| File | Role |
| --- | --- |
| `auth/auth.controller.ts` | Route definitions, cookie/header setup |
| `auth/auth.service.ts` | Business logic (login, register, refresh, logout) |
| `auth/dto/login.dto.ts` | `LoginDto` validation |
| `auth/dto/register.dto.ts` | `RegisterDto` validation |
| `auth/dto/refresh-token.dto.ts` | `RefreshTokenDto` validation |
