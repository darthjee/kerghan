# Issue: Document routes

## Description

Backend routes are currently documented only inline, inside each module's `docs/agents/modules/<module>.md` page (e.g. `modules/auth.md`'s "## Routes" section), as a compact summary table. This issue asks for a dedicated, per-domain route reference: a `docs/agents/backend/routes.md` index page, and one file per domain under `docs/agents/backend/routes/` with a detailed per-endpoint breakdown (controller, auth requirement, request body, response shape, HTTP status), plus an entry in `docs/agents/summary.md`.

The issue body already includes a fully drafted example for the Auth domain, covering all four `AuthController` endpoints (`login`, `register`, `refresh`, `logout`), shared `X-Skip-Cache` behavior, the `access_token` cookie contract, and a source-files table.

## Problem

`docs/agents/modules/<module>.md` pages are entity/event-centric — each one's "## Routes" section is a short summary table, not a full per-endpoint reference (no per-route auth/status/body breakdown). There is currently no single place an agent or contributor can go to answer "what does this endpoint expect and return" without reading the controller/DTO source directly.

## Expected Behavior

- `docs/agents/backend/routes.md` exists as an index linking to one file per documented domain.
- `docs/agents/backend/routes/auth.md` exists, containing the per-endpoint reference for all four `AuthController` routes (`POST /auth/login.json`, `/auth/register.json`, `/auth/refresh.json`, `/auth/logout.json`), the shared `X-Skip-Cache` note, the `access_token` cookie contract, and a source-files table — content already drafted in the GitHub issue body.
- `docs/agents/summary.md` and `docs/agents/index.md` reference the new routes doc(s).
- Auth is the only domain populated for now, since it is the only backend module that exists today (see `docs/agents/product.md`); future modules add their own `docs/agents/backend/routes/<domain>.md` file as they land.

## Solution

Add:
- `docs/agents/backend/routes.md` — index page listing documented domains, linking to each `docs/agents/backend/routes/<domain>.md`.
- `docs/agents/backend/routes/auth.md` — per-endpoint reference for the Auth domain, using the content already drafted below.
- An entry for the new routes doc in `docs/agents/summary.md` (and a link in `docs/agents/index.md`).

`docs/agents/modules/auth.md` keeps its existing "## Routes" summary table as-is (module docs
stay entity/event-focused, with a routes overview), and gets a link added pointing to the new
`docs/agents/backend/routes/auth.md` for the full per-endpoint detail. Both pages are kept in
sync manually going forward — some duplication between the two is accepted.

### Pre-drafted content for `docs/agents/backend/routes/auth.md`

```markdown
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

### `POST /auth/logout.json`

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
- `maxAge`: 15 minutes (matches JWT expiry)

The token is never returned in the response body — only the `refreshToken`
is, as it must be stored client-side to call `/auth/refresh.json` and
`/auth/logout.json`.

## Source files

| File | Role |
| --- | --- |
| `auth/auth.controller.ts` | Route definitions, cookie/header setup |
| `auth/auth.service.ts` | Business logic (login, register, refresh, logout) |
| `auth/dto/login.dto.ts` | `LoginDto` validation |
| `auth/dto/register.dto.ts` | `RegisterDto` validation |
| `auth/dto/refresh-token.dto.ts` | `RefreshTokenDto` validation |
```

## Benefits

- Gives agents and contributors a single, detailed, endpoint-level reference instead of needing to read controller/DTO source for request/response shapes.
- Scales cleanly as new backend modules/domains are added.
- Keeps module docs (`modules/<name>.md`) focused on entities/events, with routes broken out into their own reference.
