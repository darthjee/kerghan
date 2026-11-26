# Serving Kerghan over HTTPS on the LAN

How to use a standalone Kerghan from other machines on your network, and what `kerghan up` tells
you when it cannot work. See [release-and-caveats.md](release-and-caveats.md#caveats) for the
cookie rules behind it.

## When you need it

Plain HTTP works on the host itself with the default bind: `http://127.0.0.1:<port>` (the URL
`kerghan up` prints) or `http://localhost:<port>`, as long as no other process holds that port on
`localhost`.
Other machines need HTTPS, because the session cookies stay `Secure` for any non-loopback host and
the browser drops them over plain HTTP, so login fails silently. Login over plain HTTP from the
LAN is not supported, by design: the session tokens would cross the network in clear.

## Recipe (Caddy)

1. Keep Kerghan on loopback: `bind=127.0.0.1` (the default). The proxy is the only thing
   published on the LAN.
2. Set `auto-login=false` (`kerghan up --no-auto-login`, or `auto-login=false` in
   `~/.kerghan/config`). This is mandatory: through the proxy every LAN client reaches the
   backend from an allowed address and would be logged in as admin.
3. Put this in a `Caddyfile` (Caddy preserves `Host` and sets `X-Forwarded-Proto: https` by
   default):

   ```caddyfile
   https://<host>.local:8443 {
     tls internal
     reverse_proxy 127.0.0.1:3000
   }
   ```

4. Run `kerghan configure FRONTEND_BASE_URL=https://<host>.local:8443`, then `kerghan up`. The
   client passes `KERGHAN_COOKIE_SECURE=true`; the instance is recreated (the data volume is kept)
   and existing plain-HTTP sessions end.
5. Trust the certificate: run `caddy trust` on the host; on other devices install Caddy's local
   root (`.../pki/authorities/local/root.crt`) in the macOS keychain, as an iOS profile (then
   enable it in Certificate Trust Settings), on Android or on Windows. `mkcert` is an
   alternative.

## Caveats

- Use the `https` URL everywhere, the host included: once `FRONTEND_BASE_URL` is `https`, the
  plain-HTTP login on the host (`127.0.0.1` or `localhost`) stops working. `kerghan up` still
  prints the published address, not the proxy URL.
- The name in the URL (an mDNS `.local` name or a LAN IP) must match the certificate.
- Port 443 needs privileges on the host; 8443 does not.
- Logging in over plain HTTP on the host with a non-loopback bind needs an image with the #601
  fix (an older backend reads `loopback` as `Secure`).

## Security

- A local CA is powerful: a trusted root accepts any certificate it signs, for any domain. Install
  it only on your own devices, keep the CA files (Caddy's data directory, mkcert's `CAROOT`)
  private and remove the root when done. A real certificate for a domain you own (for example
  Let's Encrypt with DNS-01) avoids a private CA.
- Never port-forward the proxy on the router. Bind it to the LAN interface or firewall it on
  shared networks such as guest Wi-Fi.

## Any other proxy

The rules are the same for any reverse proxy:

- the `https` `FRONTEND_BASE_URL` matches the URL in the browser (`OriginGuard` and
  `SameSite=strict` rely on it);
- forward to the loopback bind;
- overwrite `X-Forwarded-Proto` (never pass a client-supplied one through);
- turn auto-login off.

## What `kerghan up` tells you

Both messages go to stderr only; stdout and the exit code do not change.

- **Plain-HTTP hint** (a `hint`, on every `up` including "already running"): printed when the
  cookie setting the client passes is `loopback`, that is a non-loopback `bind` with a
  `FRONTEND_BASE_URL` that is not `https`. On `0.0.0.0` it says other machines cannot log in over
  plain HTTP and points to the [advertised URL](client.md#advertised-url)
  (`http://127.0.0.1:<port>`) on the host; on a specific LAN address it says logging in over
  plain HTTP fails on that address. Both link to this page.
- **Auto-login behind a proxy warning** (also printed by `kerghan configure`, never by the
  plain-HTTP hint): printed when auto-login is on, the `bind` is loopback and the effective
  `FRONTEND_BASE_URL` is `https`, because a reverse proxy may then publish Kerghan to anyone who
  can reach it, logged in as admin.
