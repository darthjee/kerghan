# Automatic login

Implemented by #370 (`status.json` contract by #375). Part of the
[default-user specs](README.md).

## Background

Kerghan authenticates with httpOnly cookies. `login.json` issues a short-lived JWT `access_token`
and a refresh token stored in the database (a session). The global `JwtGuard`
(`backend/src/core/jwt.guard.ts`) verifies the `access_token` cookie on every non-public request,
and the frontend calls `status.json` (`backend/src/auth/auth.controller.ts`) on load to find out
whether the user is logged in.

## When automatic login applies

When `DefaultUserConfig.isAlwaysAuthenticated()` is true, `status.json` logs the caller in as the
default user and issues real cookies and a real session, exactly as `login.json` does. It happens
**only in `status.json`**, and only when both hold:

- **There is no valid session.** `status.json` decides this by the `refresh_token` cookie alone,
  as it does today; it never reads the access token. A valid refresh cookie follows the existing
  flow unchanged, whoever its user is (for example after an explicit login as another user). See
  [Response contract](#response-contract) for the exact check.
- **The client IP is allowed.** The IP is resolved with the existing `KERGHAN_TRUSTED_PROXY_HOPS`
  handling (the same one the authorization-request endpoint uses) and checked against the
  allowlist ([security.md](security.md#ip-allowlist)).

A request from a disallowed IP gets the normal unauthenticated response, with no error.

From then on, everything behaves as a normal session: refresh, the session list, revocation,
`AdminGuard` and the frontend all work unchanged. Each new browser or client without cookies gets
its own session (a refresh-token row).

## What stays unchanged

- **`JwtGuard` and every other protected endpoint.** A request without a cookie still gets `401`.
  An expired access token mid-session is renewed through the normal `refresh.json` flow.
- **Logout.** It clears the session as usual; the next `status.json` logs in as the default user
  again.

## Boot warning

While automatic login is on, the backend logs a prominent warning at every boot, naming the default
username and the effective IP allowlist. It never includes the password.

## Turning it off

Sessions already created by automatic login stay valid until they expire. They are not revoked at
boot.

## Rejected alternatives

- **Bypassing authentication in the guard** (filling `request.user` without issuing tokens):
  session-dependent features (the session list, revocation, logout) and the frontend's
  `status.json` would all need special handling.
- **Automatic login in `JwtGuard`:** it would flood the refresh-token table and turn the guard from
  a token verifier into a token issuer; see [security.md](security.md#session-flooding).

## Response contract

Decided by #375. This is the contract of `POST /auth/status.json` when automatic login is on
(`DefaultUserConfig.isAlwaysAuthenticated()` is true).

### No valid session

It is the check `status.json` already makes. There is no valid session when the `refresh_token`
cookie is missing, or when it is unknown, expired or revoked (including a session revoked from
another device). `status.json` never reads the access token.

A valid refresh cookie wins and follows today's flow unchanged, whoever its user is. `status.json`
stays passive: it never revokes anything, on any path.

### Response body

The body is identical to any logged-in `status.json`:

```text
{ "loggedIn": true, "isAdmin": <boolean> }
```

`isAdmin` comes from the default user. There is no automatic-login indicator and no extra field. A
frontend indicator is a separate issue and out of scope.

### Cookies

The cookies are exactly the ones `login.json` sets, through the same `setSessionCookies` helper
(`backend/src/auth/auth-cookies.ts`). All are `secure` and `sameSite=strict`:

| Cookie | `httpOnly` | Path | Expiry (`maxAge`) |
|---|---|---|---|
| `access_token` | yes | `/` | access-token TTL |
| `refresh_token` | yes | `/auth` | expires with the refresh-token row |
| `logged_in=1` | no | `/` | same as `refresh_token` |

### Session lifetime

The session is a regular session: `keepSignedIn: false`, with the regular refresh TTL, never
`KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS`. When it expires, the next `status.json` simply logs in
again.

### Disallowed IP or feature off

The response is byte-for-byte today's unauthenticated response: `201 { "loggedIn": false,
"isAdmin": false }`, with the session cookies cleared. (`201` because the
route, like every `POST`, has no `@HttpCode` override.) Nothing hints that the feature exists.

### Caching

Unchanged. `AuthController` keeps `@CachePolicy(CacheClass.Never)`, so the response stays
non-cacheable and user-scoped (`X-Skip-Cache`).

### Session metadata

There are no new columns or fields. The session appears in `sessions/mine.json` like any
password-login session (`startedAt`, `lastUsedAt`, `keepSignedIn: false`, `current`) and can be
revoked the same way. No user agent or IP is recorded, as for any other session today.

## Required tests

- `status.json` with no cookie from an allowed IP logs in as the default user and sets cookies and
  a session.
- `status.json` with no cookie from a disallowed IP returns the normal unauthenticated response.
- No automatic login when `isAlwaysAuthenticated()` is false.
- An existing valid session wins, including an explicit login as another user.
- An expired access token with a valid refresh cookie follows the refresh flow, not automatic
  login.
- Protected endpoints still return `401` without a cookie.
- After logout, the next `status.json` logs in automatically again.
- The boot warning names the username and the allowlist and does not contain the password.
- On automatic login the body is exactly `{ loggedIn: true, isAdmin }`, with `isAdmin` from the
  default user and no extra field.
- The cookie names and attributes (`httpOnly`, `secure`, `sameSite`, `path`, `maxAge`) match the
  ones `login.json` sets.
- The session is created with `keepSignedIn: false` and the regular refresh TTL.
- A revoked, expired or unknown refresh cookie from an allowed IP triggers automatic login.
- A disallowed IP gets exactly `{ loggedIn: false, isAdmin: false }` with the session cookies
  cleared.
- The never-cache headers (`X-Skip-Cache`) are present on the automatic-login response.
- The new session is listed in `sessions/mine.json` as `current`, with `keepSignedIn: false`.
