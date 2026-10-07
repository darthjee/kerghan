# Cookie helpers and session expiry

Centralize the auth cookies so every controller sets, reads and clears them the same way.

- Add `refreshTokenExpiresAt: Date` to `AuthResult` (`token.service.ts`). Fill it from the minted row's `expiresAt` so the cookie's maxAge matches the token's server-side expiry (regular or persistent TTL).
- In a new `backend/src/auth/auth-cookies.ts` (or inside `auth-response.ts` if it stays small), export:
  - constants `ACCESS_TOKEN_COOKIE = 'access_token'`, `REFRESH_TOKEN_COOKIE = 'refresh_token'`, `LOGGED_IN_COOKIE = 'logged_in'`, `REFRESH_TOKEN_COOKIE_PATH = '/auth'`;
  - `setSessionCookies(res, result, configService)`, which sets all three cookies with the options in the shared contract;
  - `clearSessionCookies(res)`, which clears all three, each with its original `path` (and the same `secure`/`sameSite` options) so browsers actually drop them;
  - `readRefreshToken(req): string | undefined`, which reads `req.cookies?.refresh_token`.
- Change `respondWithSession` (`auth-response.ts`) to call `setSessionCookies` and return only `{ user: serializeUser(user) }`.
- Remove the duplicated `ACCESS_TOKEN_COOKIE` constant from `auth.controller.ts` and `auth-response.ts`, and use the shared one.

## Files to Change
- `backend/src/auth/token.service.ts` — expose `refreshTokenExpiresAt` on `AuthResult`
- `backend/src/auth/auth-cookies.ts` (new) — cookie constants and set/clear/read helpers
- `backend/src/auth/auth-response.ts` — use `setSessionCookies` and drop `refreshToken` from the body
