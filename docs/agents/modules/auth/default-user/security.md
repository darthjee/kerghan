# Default user: security

Part of the [Default user](../default-user.md) hub, itself part of the [Auth module](../../auth.md). IP allowlist, production guard and exposure of automatic login.

## Security

### IP allowlist

`KERGHAN_DEFAULT_USER_ALLOWED_IPS` decides who can receive the automatic login.

- A request from outside the list gets the normal unauthenticated response, with no error.
- Empty or unset means loopback only (`127.0.0.1`, `::1`): opening automatic login to remote
  clients is always a deliberate choice.
- IPv4-mapped IPv6 client addresses (`::ffff:a.b.c.d`, as Node reports IPv4 clients on a
  dual-stack socket) are matched as their IPv4 form.
- A malformed IP or CIDR fails at boot, naming the bad entry.
- The client IP is resolved with `KERGHAN_TRUSTED_PROXY_HOPS`, so a forged `X-Forwarded-For`
  entry beyond the trusted hops cannot bypass the allowlist. An invalid value (not a non-negative
  integer) falls back to the default (`1`) instead of trusting the leftmost, client-supplied
  entry. With `0` and an `X-Forwarded-For` header present, no IP is resolved, so automatic login
  stays off (fails closed).
- **Deployment invariant:** that guarantee only holds when every request reaches the backend
  through Tent, which overwrites `X-Forwarded-For` (`SetClientIpMiddleware`). The backend does not
  check that the socket peer is Tent, so anyone who can reach the backend port directly can forge
  the resolved IP (for example `X-Forwarded-For: 127.0.0.1`). While automatic login is on, never
  expose the backend port beyond loopback or the internal Docker network. The dev
  `docker-compose.yml` binds it to `127.0.0.1`. Checking the socket peer against a configured
  trusted-proxy address is a possible future hardening, not decided.
- This lets a production deployment turn on automatic login only for known networks (an office
  or VPN range) while everyone else uses the normal login.

### Production guard

When `STAGE=production` and `isAlwaysAuthenticated()` is true, the backend **refuses to boot**
unless `KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION=true` is also set. The check lives in
`DefaultUserConfig`. `ENABLED` alone (no automatic login) boots in production without it. The
guard keys on `STAGE`, not `NODE_ENV`; the standalone stack does not set `STAGE`.

### Admin access

With `KERGHAN_DEFAULT_USER_ADMIN=true`, **whoever receives the automatic login is an admin**. That
is intended for standalone. An online deployment can avoid it with
`KERGHAN_DEFAULT_USER_ADMIN=false` (the default).

### Credentials

- The default user's password is never logged: not in boot validation errors, not in the boot
  warning, not in the collision error.
- The standalone client generates it with `openssl rand -hex 24` (48 random hex characters); see
  [standalone.md](../../../standalone/client.md#secrets).

### Standalone exposure

While automatic login is on, the standalone client publishes its port on `127.0.0.1` by default
instead of every interface; `bind` is the real exposure guard there, not the allowlist. See
[standalone.md](../../../standalone/config-files.md#config-format) and its
[Effective client IP](../../../standalone/inner-stack.md#effective-client-ip) section.

### Sessions after turning it off

Sessions created by automatic login stay valid until they expire; turning the feature off does not
revoke them.

