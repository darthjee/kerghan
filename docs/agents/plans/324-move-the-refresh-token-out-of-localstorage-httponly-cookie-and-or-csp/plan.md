# Plan: Move the refresh token out of localStorage (httpOnly cookie and/or CSP)

Issue: [324-move-the-refresh-token-out-of-localstorage-httponly-cookie-and-or-csp.md](../../issues/324-move-the-refresh-token-out-of-localstorage-httponly-cookie-and-or-csp.md)

## Overview

The refresh token moves from `localStorage` and request/response bodies into an httpOnly `refresh_token` cookie scoped to `/auth`. A readable `logged_in` cookie drives the frontend's optimistic login state. The backend sets, reads and clears the cookies. The frontend stops storing and sending the token, and migrates a token left in `localStorage` with a one-time body-carried refresh. The Content-Security-Policy is out of scope (#331).

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

### Cookies (set by the backend, all `Secure`, `SameSite=Strict`)

| Name | httpOnly | Path | Value | maxAge |
|---|---|---|---|---|
| `access_token` | yes | `/` (unchanged) | JWT | access-token TTL (unchanged) |
| `refresh_token` | yes | `/auth` | raw refresh token | `expiresAt - now` of the refresh-token row (regular TTL 7 days, persistent TTL 30 days) |
| `logged_in` | **no** | `/` | `1` | same as `refresh_token` |

- **Set** on every session-minting response: `POST /auth/login.json`, `POST /auth/register.json`, `POST /auth/refresh.json`, and the winning `approved` `POST /auth/authorization-requests/:uuid/poll.json`.
- **Cleared** (all three, each with the same `path` it was set with) by `DELETE /auth/logoff.json`, by a `POST /auth/refresh.json` that fails with `401`, and by a `POST /auth/status.json` that answers `loggedIn: false`.

### Response bodies

- `login` / `register` / `refresh`: `{ user }`. **`refreshToken` is no longer returned.**
- `poll` (approved): `{ status: 'approved', user }`; other statuses unchanged.
- `status`: unchanged (`{ loggedIn, isAdmin }`).

### Request bodies

- `refresh`, `logoff`, `status`, `sessions/mine`, `sessions/revoke-others`, `sessions/:uuid/revoke`: no body fields. The backend reads `req.cookies.refresh_token`.
- `PATCH /auth/account.json`: the `refreshToken` field is removed. The session to keep on a password change is the one identified by the `refresh_token` cookie (missing or unknown cookie: revoke all, as today).
- **Migration fallback (temporary):** `POST /auth/refresh.json` accepts an optional body `{ refreshToken }` **only when the `refresh_token` cookie is absent**. The cookie always wins. Mark it in code and docs with `TODO(#324-migration)` for later removal.
- A missing cookie (and no fallback token) means: `refresh` returns `401`, `status` returns `{ loggedIn: false, isAdmin: false }`, `logoff` returns `204` (and clears the cookies), and `sessions/*` behave as with an unknown token today.

### Frontend migration key

The legacy `localStorage` key is `kerghan_refresh_token`.
