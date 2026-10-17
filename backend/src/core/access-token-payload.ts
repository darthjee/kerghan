/**
 * The shape signed into the access token by `TokenService#issueTokens`
 * (`backend/src/auth/token.service.ts`) — `{ sub, sid, username, isAdmin }`,
 * where `sid` is the `sessionUuid` of the refresh-token session the token was
 * minted for — and the shape of `request.user`. `JwtGuard`
 * (`backend/src/core/jwt.guard.ts`) verifies the token, checks that its
 * session is still active, and builds `request.user` from the session's
 * joined user row, not from the raw payload: the signed `username`/`isAdmin`
 * are never trusted for authorization.
 * Lives in `core/` (not `auth/`) to avoid an `auth → core` type import
 * cycle and to let `express.d.ts` import it directly.
 */
export interface AccessTokenPayload {
  sub: number;
  sid: string;
  username: string;
  isAdmin: boolean;
}
