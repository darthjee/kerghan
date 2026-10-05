# Backend Plan: Backend: list & revoke sessions API

Main plan: [plan.md](plan.md)

## Overview
Add a session identity (`session_uuid`, `started_at`) to `auth_refresh_tokens`. `TokenService#issueTokens` mints it for a new login and carries it over on rotation. A new `SessionService` holds the list/revoke logic, and a thin `SessionController` exposes it under `auth/sessions/*`.

## Context
- Each login mints a row in `auth_refresh_tokens`. `AuthService#refresh` revokes the presented row and calls `TokenService#issueTokens`, which mints a brand-new row, so nothing links the two rows except `userId`. `keepSignedIn` is already carried over this way (#319).
- Since only one token in a chain is ever unrevoked, "a session" is exactly one active (non-revoked, unexpired) row, identified by its `session_uuid`.
- `TokenService#revokeUserTokens(userId, keepRefreshToken)` (#321) already revokes every unrevoked token of a user except the presented one. That is exactly "revoke all others" once the presented token has been validated.
- Cache: `@CachePolicy(CacheClass.Never)` at controller level makes `CachePolicyInterceptor` send `X-Skip-Cache: true` and `Cache-Control: no-store`, the same as `AuthorizationRequestController`.
- Decisions taken in the issue:
  - the session id is a UUID;
  - routes are `POST`, under `auth/sessions/`;
  - an unknown or foreign id returns 404;
  - revoking the current session by id is allowed;
  - `revoke-others` with a missing or invalid current token returns 401 and revokes nothing;
  - no user agent or IP is stored;
  - `auth_sessions` is left untouched.

## Steps

- [01 — Session columns: migration and entity](backend/01-session-columns.md)
- [02 — Mint and carry the session on login and rotation](backend/02-carry-session.md)
- [03 — SessionService: list, revoke one, revoke others](backend/03-session-service.md)
- [04 — SessionController, DTO and e2e specs](backend/04-session-controller.md)
- [05 — Documentation](backend/05-docs.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- A 401 from `revoke-others` can trigger the frontend `ApiClient` refresh-and-retry, the reason `authorize.json` uses 400 for business rejections. Here the 401 was an explicit product choice, and it only fires when the client's stored refresh token is already invalid, so refreshing fails and the client logs out. Document it in the route doc so the frontend sub-issue knows.
- `mine.json` does not reject a missing or invalid `refreshToken`: it lists the caller's sessions with no `current: true` entry. Only `revoke-others` is strict, because only there would an invalid token change what gets revoked. The DTO still requires the field, so the body shape is the same everywhere.
- The `revokedAt`-replay path in `AuthService#findActiveRefreshToken` still revokes every token of the user. That is unchanged and intentional.
- No Navi resources: these endpoints are user-scoped and never cached, so nothing should be warmed. The cache agent reviews only.
- Reviews: data-access (the response fields are scoped to the caller), security (ownership checks, no enumeration, 401 path) and cache (`@CachePolicy` + `X-Skip-Cache`).
