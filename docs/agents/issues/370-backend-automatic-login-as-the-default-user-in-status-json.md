# Issue: Backend: automatic login as the default user in status.json

## Description
Part of #366. When `DefaultUserConfig.isAlwaysAuthenticated()` is true, `POST /auth/status.json` logs the caller in as the default user automatically, issuing real cookies and a real session exactly as `login.json` does, so every existing feature (refresh, the session list, revocation, `AdminGuard`, the frontend) keeps working unchanged.

The full contract is in `docs/agents/specs/default-user/automatic-login.md` (response contract decided by #375) and `docs/agents/specs/default-user/security.md`. Its dependencies are all merged: #368 (`DefaultUserConfig`, including `isIpAllowed`), #369 (boot-time sync of the default user) and #375 (the contract).

## Problem
The default user exists after boot (#369), but nothing logs anyone in as that user. With always-authenticated turned on, a standalone user still sees the login screen.

## Expected Behavior
- **Only in `status.json`.** `JwtGuard` and every other protected endpoint are unchanged: a request without a cookie still gets `401`. This avoids session flooding from cookie-less clients.
- **Only without a valid session.** As today, `status.json` decides this from the `refresh_token` cookie alone and never reads the access token. A missing, unknown, expired or revoked refresh cookie counts as no session. A valid refresh cookie follows the existing flow unchanged, whoever its user is (for example after an explicit login as another user). `status.json` never revokes anything.
- **Only for allowed client IPs.** The IP is resolved with the existing `KERGHAN_TRUSTED_PROXY_HOPS` handling (`backend/src/core/client-request.ts`, as the authorization-request endpoint does) and checked with `DefaultUserConfig.isIpAllowed()`.
- **Response on automatic login:** exactly `{ "loggedIn": true, "isAdmin": <default user is_admin> }`, with no extra field.
- **Cookies:** set through the same `setSessionCookies` helper `login.json` uses (`access_token`, `refresh_token`, `logged_in=1`, same attributes).
- **Session:** a regular session with `keepSignedIn: false` and the regular refresh TTL. It shows up in `sessions/mine.json` like any other session. No new columns.
- **Disallowed IP or feature off:** byte-for-byte today's unauthenticated response, `200 { "loggedIn": false, "isAdmin": false }` with the session cookies cleared. No error, and nothing hints that the feature exists.
- **Caching:** unchanged, `AuthController` keeps `@CachePolicy(CacheClass.Never)`.
- **Logout** works normally, and the next `status.json` logs in again.
- **Boot warning:** while automatic login is on, log a prominent warning at every boot naming the default username and the effective allowlist, never the password. No such warning exists yet.
- **Turning it off:** sessions already created stay valid until they expire. Nothing is revoked at boot.

## Solution
- Put the logic in `AuthService` (or a small default-user login service in the auth module), not in `AuthController`, which stays thin: the controller passes the refresh cookie and the resolved client IP to the service.
- Reuse the existing session-creation path used by `login.json` (without the password check), so tokens, the refresh-token row and cookies are identical.
- Emit the boot warning from the auth module at startup when `isAlwaysAuthenticated()` is true.
- Cover every rule above with Jest specs, including every test listed under "Required tests" in `automatic-login.md` and `security.md` (a forged `X-Forwarded-For` beyond the trusted hops is ignored, the password is absent from every log line).
- Request a security review: this changes authentication logic.

## Benefits
The standalone distribution (#371) can open straight into the app as the default user, while a regular deployment can turn it on only for known networks and everyone else keeps the normal login.
