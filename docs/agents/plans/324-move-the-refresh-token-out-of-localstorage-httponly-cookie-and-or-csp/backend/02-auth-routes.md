# Switch auth routes to the cookie

Update `AuthController` so `refresh`, `logoff` and `status` read the token from the cookie, through `@Req()` plus `readRefreshToken`.

- `refresh.json`: token = cookie, or (only when the cookie is absent) the optional body `refreshToken` (`TODO(#324-migration)`). When neither is present, throw `401` without touching the database. On an `UnauthorizedException` from `AuthService#refresh`, call `clearSessionCookies(res)` and rethrow. On success, use `respondWithSession`.
- `logoff.json`: when a cookie token is present, revoke it through `AuthService#logout`. Always call `clearSessionCookies(res)` and answer `204`.
- `status.json`: `AuthService#status(token)` with the cookie (an absent cookie returns `{ loggedIn: false, isAdmin: false }` without a DB lookup). When the result is `loggedIn: false`, call `clearSessionCookies(res)` (this needs `@Res({ passthrough: true })`).
- Replace `RefreshTokenDto` with an optional-field `RefreshFallbackDto` (`@IsOptional() @IsString() refreshToken?`) used only by `refresh.json`, and delete `RefreshTokenDto` once no route uses it. `logoff`/`status` take no body DTO.
- Keep the controller thin. If the "cookie or fallback" choice grows beyond a line, put it in the cookie helper module, not in the controller.

## Files to Change
- `backend/src/auth/auth.controller.ts` — cookie-based `refresh`/`logout`/`status`, clearing cookies on failure and logoff
- `backend/src/auth/dto/refresh-token.dto.ts` — replace with the optional migration-fallback DTO (rename the file accordingly)
- `backend/src/auth/auth.service.ts` — only if `status`/`logout` need to accept `undefined` (keep the file ≤ 300 lines)
