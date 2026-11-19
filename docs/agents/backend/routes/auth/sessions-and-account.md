# Routes — Auth: Sessions and account

Part of the [Auth routes](../auth.md) reference. Covers the session-management endpoints and the account endpoints.

### Sessions

A *session* is one chain of rotated refresh tokens: every token minted on login (password,
device-authorization or register) gets a fresh `session_uuid` and `started_at`, and every
`POST /auth/refresh.json` copies both onto the replacement token. Since rotation revokes the
presented token, an active session is exactly one non-revoked, unexpired `auth_refresh_tokens`
row. The *current* session is the one whose refresh token matches the `refresh_token` cookie
(the same convention as `logoff`/`status`). The session routes take no request body; the cookie
reaches them because they live under its `Path=/auth`. No user agent or IP is captured or shown.

### `POST /auth/sessions/mine.json`

| Property | Value |
| --- | --- |
| Controller | `SessionController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request | `refresh_token` cookie (no body) |
| Success response | `{ sessions: [{ id, startedAt, lastUsedAt, keepSignedIn, current }] }` |
| HTTP status | `201` (Nest's `POST` default) |

Lists the caller's own active (non-revoked, unexpired) sessions, most recently used first. `id`
is the session UUID; `startedAt` is the login time; `lastUsedAt` is the active token's
`issuedAt` (the latest login or rotation); `current` is `true` for the session matching
the cookie. A missing, unknown, revoked, expired or foreign token is not an error: the list
is still returned, with no entry marked `current`.

### `POST /auth/sessions/:uuid/revoke.json`

| Property | Value |
| --- | --- |
| Controller | `SessionController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request body | None expected (any body is ignored) |
| Success response | `{ revoked: true }` |
| HTTP status | `201`; `400 Bad Request` for a malformed `:uuid`; `404 Not Found` for an unknown, already-revoked or another user's session |

Revokes one of the caller's sessions (its unrevoked token, `revokedReason` `user_revoked`).
`:uuid` is validated by `ParseUUIDPipe` accepting any UUID version (sessions backfilled by the
migration carry MySQL `UUID()` v1 IDs); a malformed value answers `400`. An unknown session and
another user's session both answer the same `404`, so existence never leaks. Revoking the
current session is allowed and behaves like a logoff (the access-token cookie is left alone, but
the next authenticated request gets `401`, and the client's refresh then gets `401` too, which
clears the session cookies). The revoked session's later
refresh attempts get a plain `401` without triggering replay detection.

**Revocation applies on the next request.** The session gate in `JwtGuard` checks that the
access token's `sid` names an active session on every request, so a revoked session's
access token is refused on its next request, even before it expires (see
[Session lookup](../../../modules/auth/sessions.md#jwtrefresh-token-flow)). This applies to both
session-revoke routes.

### `POST /auth/sessions/revoke-others.json`

| Property | Value |
| --- | --- |
| Controller | `SessionController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request | `refresh_token` cookie (no body) |
| Success response | `{ revoked: true }` |
| HTTP status | `201`; `401 Unauthorized` when the cookie is missing or its token is invalid |

Revokes every session of the caller except the current one (`revokedReason` `user_revoked`).
The current session is kept by its `sessionUuid` (resolved from the cookie's token), not by the
token's hash, so a concurrent rotation of the current session is never revoked by mistake.
When the cookie is missing or its token is unknown, revoked, expired or another user's, it answers `401` and
revokes nothing — it never falls back to revoking every session. The revoked sessions' later
refresh attempts get a plain `401` without triggering replay detection.

Note for the frontend: a `401` here can trigger `ApiClient`'s refresh-and-retry. That is
intentional: it only happens when the client's refresh-token cookie is already invalid, so the
refresh fails too and the client logs out (unlike `authorize.json`, which uses `400` for its
business rejections precisely to avoid that path).

### `PATCH /auth/account.json`

Self-edit of the logged-in user (`AccountService.updateAccount`, `JwtGuard`).

| Field | Type | Meaning |
| --- | --- | --- |
| `username`, `email`, `newPassword` | strings, optional | The managed fields. A `null` answers `400 VALIDATION_FAILED`. |
| `currentPassword` | string, optional | Required **only** when a managed field is present. An empty string answers `400 VALIDATION_FAILED`; a missing one with a managed field answers `400 BAD_REQUEST` (`currentPassword is required`) after the default-user block and the lockout check, and counts as an abuse-guard failure like a wrong password. |
| `githubHandle` | `string \| null`, optional | The [GitHub handle](../../../modules/auth/github-handle.md): normalised and validated; `null` or `""` clears it. Absent: unchanged. |

- `assertAnyFieldPresent` counts `githubHandle` as present whenever the key is in the body, `null`
  included; the message is `At least one of username, email, newPassword or githubHandle is
  required` (the admin edit keeps its own three-field message).
- **Handle-only edit** (no managed field): needs no `currentPassword` (ignored if sent), skips the
  lockout check (`423`) and the abuse guard entirely (it never counts as a failure and never
  resets the counter), and is a no-op write when the normalised value equals the stored one. Order:
  validation (`400`) → `assertAnyFieldPresent` (`400`) → load the user (`401` if missing) → write
  → `200`.
- **Mixed edit** (a managed field and `githubHandle`): the existing path, unchanged. The handle is
  written in the same update as the other fields, all or nothing.
- **Response:** `200 { username, email, githubHandle }` on both paths (`githubHandle` is `null`
  when unset).
- Changing the handle never revokes sessions and never triggers a repository sync.
- A password change revokes the user's sessions, as before.

Rules and rationale: [GitHub handle](../../../modules/auth/github-handle.md#setting-it-patch-authaccountjson).

### `POST /auth/account/mine.json`

Reads the logged-in user's own account, so the Account page can show the current handle.

| Property | Value |
| --- | --- |
| Request | No body; always the session's own user, no id in the request |
| Success response | `201` `{ "username": "…", "email": "…", "githubHandle": "darthjee" }` (`githubHandle` is `null` when unset) |
| Errors | `401` when the session's user no longer exists |
| Guards and cache | `JwtGuard`; `POST` so `OriginGuard` covers it; `@CachePolicy(CacheClass.Never)` (`X-Skip-Cache: true`) |
