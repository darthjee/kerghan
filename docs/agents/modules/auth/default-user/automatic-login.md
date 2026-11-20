# Default user: automatic login

Part of the [Default user](../default-user.md) hub, itself part of the [Auth module](../../auth.md). How `status.json` logs a client in as the default user.

## Automatic login

When `isAlwaysAuthenticated()` is true, `POST /auth/status.json` logs the caller in as the default
user (`AuthService#status` → `DefaultUserService#autoLogin`) when both hold:

- **There is no valid session.** `status.json` decides this by the `refresh_token` cookie alone,
  as always: missing, unknown, expired or revoked means no session. It never reads the access
  token. A valid refresh cookie wins and follows the normal flow, whoever its user is (for
  example after an explicit login as another user).
- **The client IP is allowed.** The IP is resolved with the existing `KERGHAN_TRUSTED_PROXY_HOPS`
  handling (`extractClientRequestInfo` in `backend/src/core/client-request.ts`, the same one the
  device-authorization endpoint uses) and checked with `isIpAllowed`. An empty IP is never
  allowed.

It also needs boot sync to have recorded an id and the row to still exist; otherwise the caller
gets the normal unauthenticated answer.

The session is minted through `TokenService#issueTokens`, the same path `login.json` uses, with
`keepSignedIn: false` (regular refresh TTL), and the controller sets the same cookies through
`setSessionCookies`. From then on, it is a normal session: refresh, the session list, revocation,
`AdminGuard` and the frontend all work unchanged. Each browser or client without cookies gets its
own session. The wire contract is in
[Auth routes](../../../backend/routes/auth/login.md#post-authstatusjson).

What stays unchanged:

- **`JwtGuard` and every other protected endpoint.** A request without a cookie still gets `401`.
  An expired access token mid-session is renewed through the normal `refresh.json` flow.
- **Logout** clears the session as usual; the next `status.json` logs in as the default user
  again.
- **`status.json` stays passive** on every automatic-login path: it never revokes anything
  there. Its only write is revoking a denied user's still-active token (`admin_denied`), see
  [Auth routes](../../../backend/routes/auth/login.md#post-authstatusjson).

### Boot warning

While automatic login is on, every boot logs a warning,
`AUTOMATIC LOGIN IS ON: status.json logs callers in as the default user`, with the default
username and the effective IP allowlist. It never includes the password.

### Turning it off

Sessions already created by automatic login stay valid until they expire. They are not revoked at
boot.

### Why only `status.json`

- **Rejected: bypassing authentication in the guard** (filling `request.user` without issuing
  tokens). The session list, revocation, logout and the frontend's `status.json` would all need
  special handling.
- **Rejected: automatic login in `JwtGuard`.** Any protected request without a cookie (a `curl`
  loop, a monitor, a crawler) would create a new refresh-token row every time, and the table would
  grow without limit (session flooding). It would also turn the guard from a token verifier into
  a token issuer that writes cookies.
- The frontend always calls `status.json` first, so this gives one session per browser and covers
  the full browser experience. API clients without a cookie still get `401`.

