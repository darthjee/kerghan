# HTTPS recipe and docs updates

## New page `docs/agents/standalone/https.md`

Title: "Serving Kerghan over HTTPS on the LAN". User-facing (the `kerghan up` hint links to it on
`main`). Sections:

1. **When you need it** — plain HTTP works on the host (`http://localhost:<port>` /
   `127.0.0.1`); other machines need HTTPS because session cookies stay `Secure` for LAN hosts.
   No plain-HTTP LAN login is supported, by design (tokens would cross the network in clear).
2. **Recipe (Caddy)**:
   1. Keep Kerghan on loopback: `bind=127.0.0.1` (the default) — the proxy is the only thing
      published on the LAN.
   2. `auto-login=false` — **mandatory**: through the proxy every LAN client reaches the backend
      from an allowed host/Docker gateway address and would be logged in as admin.
   3. Caddyfile:
      ```caddyfile
      https://<host>.local:8443 {
        tls internal
        reverse_proxy 127.0.0.1:3000
      }
      ```
      (Caddy preserves `Host` and sets `X-Forwarded-Proto: https` by default.)
   4. `kerghan configure FRONTEND_BASE_URL=https://<host>.local:8443`, then `kerghan up` — the
      client passes `KERGHAN_COOKIE_SECURE=true`; the instance is recreated (data volume kept)
      and existing plain-HTTP sessions end.
   5. Trust the certificate: `caddy trust` on the host; on other devices install Caddy's local root
      (`…/pki/authorities/local/root.crt`) — macOS keychain, iOS profile + "Certificate Trust
      Settings", Android, Windows. `mkcert` as an alternative.
3. **Caveats** — use the `https` URL everywhere, the host included (plain-HTTP `localhost` login
   stops working once the URL is `https`); the name (mDNS `.local` or a LAN IP — the certificate
   must match it); 443 vs 8443 (443 needs privileges); the minimum image version for plain-HTTP
   host login on a non-loopback bind (#601; an older image reads `loopback` as `Secure`).
4. **Security** — local CA power (a trusted root accepts any certificate it signs, for any domain:
   install it only on your own devices, keep the CA files — Caddy's data dir / mkcert `CAROOT` —
   private, remove the root when done; a real certificate for a domain you own, e.g. Let's Encrypt
   DNS-01, avoids a private CA); exposure (never port-forward the proxy on the router; bind it to
   the LAN interface or firewall it on shared networks such as guest Wi-Fi).
5. **Any other proxy** — the rules: the `https` `FRONTEND_BASE_URL` matches the browsed URL
   (`OriginGuard` / `SameSite=strict` rely on it); forward to the loopback bind; overwrite
   `X-Forwarded-Proto` (never pass a client-supplied one through); auto-login off.
6. **What `kerghan up` tells you** — the plain-HTTP hint and the auto-login-behind-a-proxy warning,
   with their conditions.

## Updates to existing docs

- `docs/agents/standalone.md` — add `https.md` to the "Pages" table ("You change the HTTPS/LAN
  guidance, the plain-HTTP hint or the auto-login-behind-a-proxy warning.").
- `docs/agents/standalone/release-and-caveats.md` — in the **HTTPS** caveat, replace "put your own
  TLS reverse proxy … Opt-in LAN support over plain HTTP is tracked in #603." with a link to
  `https.md` (set `FRONTEND_BASE_URL` with `kerghan configure`), and state that plain-HTTP LAN
  login is not supported by design.
- `docs/agents/standalone/client.md` — in the `up` behaviour, document the plain-HTTP hint
  (condition, bind-dependent wording, every `up` including "already running", stderr only) and the
  new warning, next to the existing auto-login warning.
- `docs/agents/standalone/client-config.md` (or the page that documents `cross_key_warnings`) —
  add the auto-login-behind-a-proxy warning to `configure`'s cross-key warnings.
- `README.md` — in "Run Kerghan standalone", one sentence linking to `https.md` for using Kerghan
  from other machines on the LAN.

## Files to Change

- `docs/agents/standalone/https.md` — new page.
- `docs/agents/standalone.md` — Pages table row.
- `docs/agents/standalone/release-and-caveats.md` — HTTPS caveat.
- `docs/agents/standalone/client.md` — `up` hint and warning.
- `docs/agents/standalone/client-config.md` — `configure` warning.
- `README.md` — link.
