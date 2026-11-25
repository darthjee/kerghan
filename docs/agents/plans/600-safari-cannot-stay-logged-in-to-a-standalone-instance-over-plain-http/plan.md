# Plan: Safari cannot stay logged in to a standalone instance over plain HTTP

Issue: [600-safari-cannot-stay-logged-in-to-a-standalone-instance-over-plain-http.md](../../issues/600-safari-cannot-stay-logged-in-to-a-standalone-instance-over-plain-http.md)

## Overview

The backend gains a `KERGHAN_COOKIE_SECURE` setting (default `true`) that drives the `secure`
option of the three session cookies, for both setting and clearing them. The standalone client
passes `KERGHAN_COOKIE_SECURE=false` only for a loopback bind whose effective `FRONTEND_BASE_URL`
is not `https`, makes the setting a recreate trigger and a client-managed key (the auto-login
pattern), and the inner stack passes it through. The docs' HTTPS caveat is corrected. A `security`
agent review is requested on the PR.

## Agents involved

- [backend](backend.md)
- [standalone](standalone.md)

## Shared contracts

- **Environment variable `KERGHAN_COOKIE_SECURE`**, read by the backend through `ConfigService` as a
  string.
  - Exactly `false` → the `access_token`, `refresh_token` and `logged_in` cookies are set **and
    cleared** without `secure`.
  - Anything else, including unset, empty, `FALSE` or a typo → `secure: true`, the current
    behaviour. This fails safe, so Render and the dev stack are unchanged.
  - `sameSite: 'strict'`, `httpOnly` and `path` are unchanged.
- **The standalone client always passes it** with `-e KERGHAN_COOKIE_SECURE=<true|false>` on every
  `vault up`.
  - `false` iff `is_loopback "$bind"` and the effective `FRONTEND_BASE_URL` does not start with
    `https://`. The effective URL is the value set in `kerghan.env`, else the derived default.
  - `true` otherwise.
- **The inner compose stack passes it through** to the `kerghan` service by name only (passed only
  when set), like `FRONTEND_BASE_URL`.
