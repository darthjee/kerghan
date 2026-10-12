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

- **There is no valid session.** A request with a valid access token, or with an expired access
  token but a valid refresh cookie, follows the existing flow (refresh is preferred). A request
  that already carries a valid identity, for example after an explicit login as another user,
  keeps it.
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

**Response body, automatic-login indicator, cookie attributes and session metadata: to be defined
by #375; do not implement before then.**

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
