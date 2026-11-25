# Issue: Standalone: document HTTPS for LAN access and hint on plain-HTTP non-loopback binds

## Description

Follow-up of #601. A standalone instance published on the LAN and served over plain HTTP cannot be logged into from other machines, and the failure is silent. Rather than adding a plain-HTTP opt-in, make LAN access over HTTPS easy to set up and make the plain-HTTP limit visible: a user-facing TLS reverse-proxy recipe, a hint on `kerghan up`, and a warning for auto-login behind a proxy.

## Problem

A standalone instance published on the LAN (`bind=0.0.0.0` or a LAN IP) and served over plain HTTP keeps its session cookies `Secure` for LAN hosts, so nobody on another machine can log in over `http://<LAN IP>:<port>` — and the login fails silently, which looks like a bug. The documented answer is a TLS reverse proxy, but the docs only mention it in passing (`docs/agents/standalone/release-and-caveats.md`) and give no recipe.

What already works over plain HTTP, and stays as is:

- Loopback bind (default `127.0.0.1`): #600 passes `KERGHAN_COOKIE_SECURE=false`, so `http://localhost:<port>` / `http://127.0.0.1:<port>` work in every browser.
- Non-loopback bind, browsed from the host itself: #601 passes `loopback`, so loopback hosts (`localhost`, `127.0.0.0/8`, `[::1]`) get non-`Secure` cookies, Safari included.

A second, related risk: someone who follows a TLS-proxy setup but leaves auto-login on makes every LAN client admin (requests reach the backend from the host/Docker gateway address, which is in the auto-login allowed IPs), and nothing warns them today because the bind is loopback.

## Expected Behavior

- `kerghan up` on a non-loopback bind with a non-`https` effective `FRONTEND_BASE_URL` prints a hint that other machines cannot log in over plain HTTP, pointing to a TLS recipe (and, on `bind=0.0.0.0`, to `http://localhost:<port>` for the host itself).
- `kerghan up` and `kerghan configure` warn when auto-login is on, the bind is loopback and the effective `FRONTEND_BASE_URL` is `https` (the shape of a proxied instance).
- A user-facing page explains, step by step, how to serve the standalone over HTTPS on the LAN, including its security caveats.
- No plain-HTTP login from the LAN, no new config key, no backend change: `KERGHAN_COOKIE_SECURE` stays client-managed and refused in `kerghan.env`.

## Solution

### 1. `kerghan up` plain-HTTP hint (standalone client)

- **Condition:** exactly when the client passes `KERGHAN_COOKIE_SECURE=loopback` — a non-loopback bind and a non-`https` effective `FRONTEND_BASE_URL` — derived from `wanted_cookie_secure`, so the hint and the cookie behaviour cannot drift. It disappears once the user sets an `https` URL or a loopback bind.
- **Where:** every `kerghan up`, including the "already running" no-op path (users debugging a failed LAN login re-run `up`). Not in `configure`.
- **Severity:** `hint` (`kerghan: hint: …` on stderr), not `warning` — nothing is misconfigured.
- **Not silenceable:** no config key for it (that would reintroduce the rejected opt-in); the real fix (HTTPS) removes it.
- **Wording depends on the bind:**
  - `bind=0.0.0.0`:
    `kerghan: hint: other machines cannot log in over plain HTTP; on this host use http://localhost:<port>, from the LAN put a TLS reverse proxy in front and set an https FRONTEND_BASE_URL (see <docs>)`
  - A specific LAN IP (loopback cannot reach the instance, so no `localhost` pointer):
    `kerghan: hint: logging in over plain HTTP fails on <bind>; put a TLS reverse proxy in front and set an https FRONTEND_BASE_URL (see <docs>)`
  - `<docs>` = `https://github.com/darthjee/kerghan/blob/main/docs/agents/standalone/https.md`.

### 2. Auto-login behind a proxy warning (standalone client)

The client cannot see a proxy, but an `https` URL on a loopback bind with auto-login on is the risky shape. Like the existing auto-login warning on a non-loopback bind, printed by both `kerghan up` and `configure` (`cross_key_warnings`):

- **Condition:** effective auto-login on (after the no-default-user fallback), loopback bind, effective `FRONTEND_BASE_URL` is `https`. On a non-loopback bind the existing auto-login warning already covers it.
- **Wording:**
  `kerghan: warning: automatic login is on and FRONTEND_BASE_URL is <url>: if a reverse proxy publishes Kerghan, anyone who can reach it is logged in as admin`
  then
  `kerghan: hint: use 'kerghan up --no-auto-login' or set auto-login=false in ~/.kerghan/config`

**Output order** on `up`: auto-login warning (existing or new), then the plain-HTTP hint, then the port-conflict warning — all before the instance starts, so they show with `up -f` too.

### 3. TLS recipe (docs)

- **Location:** new page `docs/agents/standalone/https.md` ("Serving Kerghan over HTTPS on the LAN"), linked from the README's "Run Kerghan standalone" section, from the `Secure`-cookie caveat in `docs/agents/standalone/release-and-caveats.md`, and from the hint.
- **Proxy:** Caddy as the worked example (`tls internal`), plus a note that any TLS proxy works if it follows the generic rules.
- **Steps:**
  1. Keep Kerghan on loopback: `bind=127.0.0.1` (the default) — the proxy is the only thing published on the LAN.
  2. Turn auto-login off: `auto-login=false` — **mandatory** (through the proxy every LAN client would be admin).
  3. Caddyfile: `https://<host>.local:8443 { tls internal; reverse_proxy 127.0.0.1:3000 }` (Caddy preserves `Host` and sets `X-Forwarded-Proto: https` by default).
  4. `FRONTEND_BASE_URL=https://<host>.local:8443` via `kerghan configure`, then `kerghan up` (the client passes `KERGHAN_COOKIE_SECURE=true`; the instance is recreated, data volume kept, existing plain-HTTP sessions end).
  5. Trust the certificate on every device: `caddy trust` on the host; elsewhere install Caddy's local root (`…/pki/authorities/local/root.crt`) — macOS keychain, iOS profile + "Certificate Trust Settings", Android, Windows. `mkcert` as an alternative.
  6. Caveats: use the `https` URL everywhere, the host included (plain-HTTP `localhost` login stops working once the URL is `https`); the name (mDNS `.local` or a LAN IP — the certificate must match); 443 vs 8443 (443 needs privileges); minimum image version for host login over plain HTTP on non-loopback binds (#601).
- **Security guidance in the page:**
  - Local CA power: a device that trusts the root accepts any certificate it signs, for any domain — install it only on your own devices, keep the CA files (Caddy data dir / mkcert `CAROOT`) private, remove the root when done; mention a real certificate for a domain you own (e.g. Let's Encrypt DNS-01) as the private-CA-free alternative.
  - Exposure: never port-forward the proxy on the router; bind it to the LAN interface or firewall it on shared networks (guest Wi-Fi).
- **Generic rules for any proxy:** the `https` `FRONTEND_BASE_URL` matches the browsed URL (`OriginGuard`/`SameSite=strict` rely on it); forward to the loopback bind; overwrite `X-Forwarded-Proto` (never pass a client-supplied one through); auto-login off.

### Alternatives considered

- **Opt-in plain-HTTP LAN login** (e.g. `allow-insecure-lan-login=` making the client pass `KERGHAN_COOKIE_SECURE=false` on non-loopback binds) — the original idea of this issue, **rejected**: access and refresh tokens would cross the LAN unencrypted (session hijack by anyone sniffing the network), and it adds a supported security-weakening path to maintain.
- **Letting users set `KERGHAN_COOKIE_SECURE` in `kerghan.env`** — rejected for the same reason; it stays client-managed (#600).
- **Client checking the image version to adjust the hint wording** — rejected; a docs note on the minimum image is enough for the rare `image-tag` pin.

### Edge cases

- **"Already running" path:** the hint uses the same inputs as `wanted_cookie_secure`; a different running value would have triggered a recreate, so it always matches the running instance.
- **`http` `FRONTEND_BASE_URL` with a LAN name** on a non-loopback bind: `loopback` is passed, the hint shows (correct). On a loopback bind: no hint.
- **`https` URL on a non-loopback bind** (proxy in front but Kerghan also published directly): cookies `Secure`, no hint; login over the direct HTTP port fails without leaking a token; auto-login covered by the existing warning.
- **Auto-login falling back to off** (no default user): the new warning uses the effective value, so it is not shown.
- **Auto-login warning false positive** (`https` URL used only locally, e.g. SSH tunnel): accepted — the wording is conditional and turning auto-login off clears it.

### Backward compatibility

- Nothing to migrate: no new keys, no `kerghan.env` change, no backend change; `wanted_cookie_secure` is unchanged, so a client upgrade never recreates a running instance by itself.
- Output only: new lines go to stderr; stdout and exit codes unchanged.
- New client + older image (`image-tag`): a pre-#601 image reads `loopback` as `Secure`, so the hint's `localhost` advice is wrong for Safari — handled by the docs note on the minimum image.
- Older client + the recipe: works with any client (#600+ passes `true` for `https`; pre-#600 passes nothing, backend defaults to `Secure`); the new warning exists only in the new client, hence the explicit `auto-login=false` step.

### Testing

- **bats — hint:** shown on `bind=0.0.0.0` (with `localhost` wording) and on a specific LAN IP (without); not shown on a loopback bind or with an `https` URL; shown on the "already running" path; ordering with the auto-login and port-conflict warnings.
- **bats — warning:** shown by `up` and `configure` for auto-login on + loopback + `https`; not shown with auto-login off (including the no-default-user fallback), with an `http` URL, or on a non-loopback bind.
- **bats — existing tests:** update those asserting exact `up` stderr on non-loopback binds (`bind.bats`, `port_conflict.bats`, `cookie_secure.bats`).
- **Manual:** follow the recipe end to end and log in from a second machine and from the host over the `https` URL; confirm writes work (`OriginGuard`) and plain HTTP on the LAN IP is not reachable.

### Out of scope

- Any plain-HTTP LAN login opt-in; making `KERGHAN_COOKIE_SECURE` user-settable.
- TLS built into the standalone image or a proxy bundled in the inner stack.
- A `kerghan` command that sets up the proxy or certificates (e.g. `kerghan tls`).
- Backend changes (`true|false|loopback` already cover it).
- The plain-HTTP hint in `configure`.
- IPv6 `bind` addresses (as in #601).
- Changing how auto-login decides who is allowed in (e.g. detecting proxied requests).

### Agent

standalone (client hint and warning, bats, docs), plus a `security` review of the recipe's guidance (CA trust, exposure, auto-login) and the warning's condition.

## Benefits

LAN users get a clear, safe path to multi-device access instead of a silent login failure, the risky auto-login-behind-a-proxy setup is flagged, and no session token ever crosses the network in clear.
