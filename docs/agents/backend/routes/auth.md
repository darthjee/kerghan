# Routes — Auth

Authentication and session management routes, served by two controllers under the `/auth`
prefix: `AuthController` (`auth/auth.controller.ts`, the four classic routes below — login,
register, refresh, logoff — all `@Public()`, since they exist to establish or renew credentials
and must be reachable without an already-valid access token) and
`AuthorizationRequestController` (`auth/authorization-request.controller.ts`, the five
device-authorization routes below — `create`/`poll` are `@Public()` for the same reason,
`mine`/`authorize`/`deny` require the default `JwtGuard`), and `SessionController`
(`auth/session.controller.ts`, the three session-management routes below, all requiring the
default `JwtGuard`).

Business logic lives in `AuthService` (`auth/auth.service.ts`) for the four classic routes,
`AuthorizationRequestService` (`auth/authorization-request.service.ts`) for the five
device-authorization routes, and `SessionService` (`auth/session.service.ts`) for the three
session routes; all three controllers are thin delegation layers.

## Endpoints

| Endpoint | Page |
| --- | --- |
| `POST /auth/login.json`, `POST /auth/register.json`, `POST /auth/refresh.json`, `DELETE /auth/logoff.json`, `POST /auth/status.json` | [Login](auth/login.md) |
| `POST /auth/authorization-requests.json`, `POST /auth/authorization-requests/:uuid/poll.json`, `POST /auth/authorization-requests/mine.json`, `POST /auth/authorization-requests/:uuid/authorize.json`, `POST /auth/authorization-requests/:uuid/deny.json` | [Authorization requests](auth/authorization-requests.md) |
| `POST /auth/sessions/mine.json`, `POST /auth/sessions/:uuid/revoke.json`, `POST /auth/sessions/revoke-others.json`, `PATCH /auth/account.json`, `POST /auth/account/mine.json` | [Sessions and account](auth/sessions-and-account.md) |

## Source files

| File | Role |
| --- | --- |
| `auth/auth.controller.ts` | Route definitions, cookie/header setup |
| `auth/auth.service.ts` | Business logic (login, register, refresh, logout) |
| `auth/dto/login.dto.ts` | `LoginDto` validation |
| `auth/dto/register.dto.ts` | `RegisterDto` validation |
| `auth/auth-cookies.ts` | Session cookie constants and set/clear/read helpers |
| `auth/dto/refresh-fallback.dto.ts` | `RefreshFallbackDto` — temporary body fallback for `refresh.json` (`TODO(#324-migration)`) |
| `auth/authorization-request.controller.ts` | Device-authorization route definitions, cookie/header setup |
| `auth/authorization-request.service.ts` | Device-authorization business logic (create, poll, listOpenForUser, authorize, deny) |
| `auth/authorization-request-abuse-guard.service.ts` | Rate-limit/cap/cool-off hardening logic |
| `auth/entities/authorization-request.entity.ts` | `AuthorizationRequest` entity (`auth_authorization_requests`) |
| `auth/dto/create-authorization-request.dto.ts` | `CreateAuthorizationRequestDto` validation |
| `auth/dto/poll-authorization-request.dto.ts` | `PollAuthorizationRequestDto` validation |
| `auth/dto/authorize-authorization-request.dto.ts` | `AuthorizeAuthorizationRequestDto` validation |
| `auth/session.controller.ts` | Session-management route definitions |
| `auth/session.service.ts` | Session business logic (listActive, revoke, revokeOthers) and `findActiveSessionUser`, the session lookup behind `JwtGuard` |
| `core/jwt.guard.ts` | Global access-token guard and session gate (`sid` claim, active session, `approved` user) |
| `auth/user-approval.config.ts` | `UserApprovalConfig`, the only reader of `KERGHAN_USER_APPROVAL_REQUIRED` |
| `auth/password-reset.service.ts` | Recover/reset business logic, including the denied-user rules |

## Pages

- [Login](auth/login.md) — read for `login`, `register`, `refresh`, `logoff` and `status` (including automatic login and the user-status behavior of each).
- [Authorization requests](auth/authorization-requests.md) — read for the `/auth/authorization-requests/*` device-authorization endpoints.
- [Sessions and account](auth/sessions-and-account.md) — read for the sessions endpoints (`mine`, revoke, revoke-others) and the account endpoints.
- [Shared behavior](auth/shared.md) — read for the default-user `409` (`DEFAULT_USER_MANAGED`), user status, shared caching behavior and session cookies.
