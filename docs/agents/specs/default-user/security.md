# Security

Consumed by #368, #370 and #371. Part of the [default-user specs](README.md).

## IP allowlist

`KERGHAN_DEFAULT_USER_ALLOWED_IPS` (read only through `DefaultUserConfig`) decides who can receive
the automatic login.

- A comma-separated list of IPs and/or CIDR ranges, for example
  `127.0.0.1,10.0.0.0/8,203.0.113.7`.
- A request from an IP outside the list does **not** receive the automatic login. It sees the
  normal login flow, with no error.
- When the variable is empty or unset, only loopback (`127.0.0.1`, `::1`) is allowed. Opening
  automatic login to remote clients is always a deliberate choice.
- IPv4-mapped IPv6 client addresses (`::ffff:a.b.c.d`, as Node reports IPv4 clients on a
  dual-stack socket) are matched as their IPv4 form, so `127.0.0.1` and IPv4 ranges apply to them.
- A malformed IP or CIDR fails at boot, naming the bad entry
  ([configuration.md](configuration.md#validation-at-boot)).
- The client IP is resolved with the existing `KERGHAN_TRUSTED_PROXY_HOPS` handling (see
  `backend/src/auth/authorization-request.controller.ts`), so a forged `X-Forwarded-For` header
  beyond the trusted hops cannot bypass the allowlist.
- This lets a regular production release turn on automatic login only for known networks, such as
  an office or VPN range, while everyone else uses the normal login.

## Production guard

- When `STAGE=production` and `isAlwaysAuthenticated()` is true, the backend **refuses to boot**
  unless `KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION=true` is also set. The check lives in
  `DefaultUserConfig`.
- While automatic login is on, the backend logs a prominent warning at every boot, naming the
  default username and the effective IP allowlist
  ([automatic-login.md](automatic-login.md#boot-warning)).

Turning the feature on in any production deployment (for example Render) is out of scope for the
epic.

## Session flooding

Automatic login happens **only in `status.json`**, never in `JwtGuard`:

- If the guard issued sessions, any protected request without a cookie (a `curl` loop, a monitor, a
  crawler) would create a new refresh-token row on every request, and the table would grow without
  limit.
- It would also turn the guard from a token *verifier* into a token *issuer* that writes cookies.
- The frontend always calls `status.json` first, so this gives one session per browser and covers
  the full browser experience. API clients without a cookie still get `401`.

## Credentials

- The default user's password is never logged, including in boot validation errors and the boot
  warning.
- The password the standalone client generates for `kerghan.env` is strong: 32+ random characters
  from `openssl rand`, which the client already uses ([standalone.md](standalone.md#new-installations)).

## Admin access

With `KERGHAN_DEFAULT_USER_ADMIN=true`, whoever receives the automatic login is an admin. That is
intended for standalone. An online deployment can turn it off with
`KERGHAN_DEFAULT_USER_ADMIN=false`. #373 carries this warning into the permanent docs.

## Standalone exposure

While automatic login is on, the standalone client publishes its port on `127.0.0.1` by default
instead of all interfaces. Details in [standalone.md](standalone.md#bind).

## Sessions after turning it off

Sessions created by automatic login stay valid until they expire; they are not revoked when the
feature is turned off ([automatic-login.md](automatic-login.md#turning-it-off)).

## Required tests

- A forged `X-Forwarded-For` beyond the trusted proxy hops is ignored: the allowlist sees the real
  client IP.
- A request from outside the allowlist gets no automatic login and no error.
- Production boot is refused with always-authenticated and no `ALLOW_IN_PRODUCTION=true`.
- The password is absent from every log line and error message.
- The standalone generated password is at least 32 random characters.
