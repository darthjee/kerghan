# Switch session, account and poll routes

- `SessionController`: `sessions/mine.json` and `sessions/revoke-others.json` read the current session's token with `readRefreshToken(req)` instead of `dto.refreshToken`, and drop the body DTO. `SessionService#listActive`/`#revokeOthers` must tolerate `undefined` (no session marked current; for revoke-others, keep the current fail-safe behavior for an unknown token). `sessions/:uuid/revoke.json` is unchanged apart from its JSDoc (no body expected).
- `PATCH /auth/account.json`: remove `refreshToken` from `UpdateAccountDto`. `AuthController#updateAccount` passes `readRefreshToken(req)` to `AccountService#updateAccount` as a separate argument (for example `updateAccount(userId, dto, currentRefreshToken)`), which forwards it to `TokenService#revokeUserTokens`. The behavior for a missing or unknown token stays "revoke all".
- `AuthorizationRequestController#poll`: no code change beyond what `respondWithSession` now does (sets the cookies and returns `{ user }`). Update the JSDoc so it no longer mentions `refreshToken` in the body.

## Files to Change
- `backend/src/auth/session.controller.ts` — read the cookie, drop `RefreshTokenDto`
- `backend/src/auth/session.service.ts` — accept an optional token
- `backend/src/auth/dto/update-account.dto.ts` — remove `refreshToken`
- `backend/src/auth/auth.controller.ts` — pass the cookie token to `updateAccount`
- `backend/src/auth/account.service.ts` — take the current refresh token as a parameter
- `backend/src/auth/authorization-request.controller.ts` — JSDoc only
