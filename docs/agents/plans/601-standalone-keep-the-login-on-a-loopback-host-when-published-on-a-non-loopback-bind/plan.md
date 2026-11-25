# Plan: Standalone: keep the login on a loopback host when published on a non-loopback bind

Issue: [601-standalone-keep-the-login-on-a-loopback-host-when-published-on-a-non-loopback-bind.md](../../issues/601-standalone-keep-the-login-on-a-loopback-host-when-published-on-a-non-loopback-bind.md)

## Overview

Add a third `KERGHAN_COOKIE_SECURE` value, `loopback`, in which the backend decides the `Secure`
attribute of the session cookies per request from the `Host` header: no `Secure` for a loopback
host over plain HTTP, `Secure` otherwise. The standalone client passes `loopback` on non-loopback
binds when the effective `FRONTEND_BASE_URL` is not `https`; loopback binds keep `false` (#600) and
`https` keeps `true`. Docs and the security caveat are updated, and the PR gets a `security` review.

## Agents involved

- [backend](backend.md)
- [standalone](standalone.md)

## Shared contracts

### `KERGHAN_COOKIE_SECURE` values (backend consumes, standalone client produces)

| Value | Backend behaviour |
|---|---|
| `false` (exact) | Never `Secure` (unchanged from #600). |
| `loopback` (exact) | Per request: **no** `Secure` only when the request host is loopback **and** `X-Forwarded-Proto` is not `https`; `Secure` otherwise. |
| anything else / unset | Always `Secure` (unchanged). |

The comparison is exact and case-sensitive on the value (as today with `false`), so a typo stays
`Secure`.

### Loopback host (backend)

- Source: the raw `Host` request header (`req.headers.host`), **not** `X-Forwarded-Host` and not
  Express's `req.hostname`. Verified: Tent 1.0.3's `ProxyRequestHandler` forwards the incoming
  request headers (`getallheaders()`, `Host` included) to the backend unchanged, and the standalone
  backend rule has no header-rewriting middleware.
- Strip the port (`127.0.0.1:5050` → `127.0.0.1`, `[::1]:5050` → `[::1]`), compare case-insensitively.
- Loopback iff the hostname is exactly `localhost`, an IPv4 literal in `127.0.0.0/8` (four dotted
  decimal octets, first octet `127`, each 0–255), or `[::1]`. Nothing else: no `*.localhost`, no
  prefix/suffix match (`localhost.evil.com`, `127.0.0.1.nip.io` are not loopback).
- Missing, empty or malformed `Host` → not loopback → `Secure`.

### `X-Forwarded-Proto` (backend)

In `loopback` mode, a request whose `X-Forwarded-Proto` header is `https` (case-insensitive; with a
comma-separated list, any `https` entry) keeps `Secure`. Tent passes this header through from the
client unchanged, so it is untrusted; that is acceptable because it can only **add** `Secure`
(a client spoofing it only breaks its own login), never remove it.

### Client decision (standalone produces)

`wanted_cookie_secure <bind> <port>`:

| bind | effective `FRONTEND_BASE_URL` | value |
|---|---|---|
| loopback | not `https://` | `false` (unchanged) |
| loopback | `https://` | `true` (unchanged) |
| non-loopback | not `https://` | `loopback` (**new**, was `true`) |
| non-loopback | `https://` | `true` (unchanged) |

Recreate reason when the wanted value becomes `loopback`: `allowing login over plain HTTP on
loopback hosts`.

## Notes

- Request a `security` agent review of the PR, focused on the spoofed `Host`, the cookie port-scope
  exposure on `127.0.0.1`, and a user TLS proxy forwarding to `127.0.0.1` without `X-Forwarded-Proto`.
- Manual check after merge (record in the PR): on a `bind=0.0.0.0` instance, Safari, Chrome and
  Firefox stay logged in over `http://127.0.0.1:<port>` and `http://localhost:<port>`; login over
  `http://<LAN IP>:<port>` still fails (cookies `Secure`).
- Out of scope: LAN login over plain HTTP (#603).
