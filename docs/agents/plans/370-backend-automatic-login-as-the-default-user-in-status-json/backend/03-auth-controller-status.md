# Resolve the client IP and set cookies in AuthController#status

Keep the controller thin:

- Resolve the client IP with `extractClientRequestInfo(req, trustedProxyHops).ip`, with
  `trustedProxyHops` read from `KERGHAN_TRUSTED_PROXY_HOPS` (default
  `DEFAULT_TRUSTED_PROXY_HOPS`) the same way `AuthorizationRequestController` does.
- Pass the refresh cookie and the IP to `authService.status`.
- When the result carries a `session`, call `setSessionCookies(res, session, this.configService)`.
  When `loggedIn` is false, call `clearSessionCookies(res)` as today.
- Return exactly `{ loggedIn, isAdmin }`: the session must never leak into the body.

Update the JSDoc on `status` to describe automatic login.

## Files to Change
- `backend/src/auth/auth.controller.ts` — IP resolution, cookie setting, body shape.
