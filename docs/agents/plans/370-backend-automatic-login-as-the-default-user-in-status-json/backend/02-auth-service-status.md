# Automatic login in AuthService#status

Change `AuthService#status` to take the client IP as well as the refresh token, and to return the
issued session alongside the body when automatic login happens, for example
`status(refreshToken?: string, clientIp?: string): Promise<{ loggedIn: boolean; isAdmin: boolean; session?: AuthResult }>`
(or a separate result type with `body` and `session`; pick whichever keeps the controller trivial).

- An active refresh-token row: unchanged, `{ loggedIn: true, isAdmin }` from that row's user, no
  session issued, whoever the user is.
- No active row (missing, unknown, expired or revoked cookie): call
  `defaultUserService.autoLogin(clientIp)`. On a result, return
  `{ loggedIn: true, isAdmin: result.user.isAdmin, session: result }`; on `null`, return today's
  `{ loggedIn: false, isAdmin: false }`.
- Still never revoke anything on any path.

Inject `DefaultUserService` into `AuthService` (both live in `AuthModule`; `DefaultUserService`
depends on `TokenService`, not `AuthService`, so there is no cycle).

## Files to Change
- `backend/src/auth/auth.service.ts` — new `status` signature and automatic-login branch; inject `DefaultUserService`.
