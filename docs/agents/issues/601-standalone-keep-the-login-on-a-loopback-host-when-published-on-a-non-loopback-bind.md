# Issue: Standalone: keep the login on a loopback host when published on a non-loopback bind

## Description

Follow-up of #600. When a standalone instance is published on a non-loopback bind (`bind=0.0.0.0` or a LAN IP) and served over plain HTTP, a user browsing it from the host itself (`http://127.0.0.1:<port>`, `http://localhost:<port>`) should be able to stay logged in in every browser, Safari included, without weakening the cookies sent to LAN hosts.

## Problem

#600 drops the `Secure` flag from the session cookies only on loopback binds (the client passes `KERGHAN_COOKIE_SECURE=false`). On a non-loopback bind cookies stay `Secure` for every request, so Safari cannot stay logged in over `http://127.0.0.1:<port>` / `http://localhost:<port>` (Chrome and Firefox only work because they treat `127.0.0.1` as a secure context).

The backend cannot tell host requests from LAN requests by client address: host requests reach it from a Docker gateway address (see the comment above `DEFAULT_USER_ALLOWED_IPS` in `standalone/bin/kerghan`), in the same private ranges as LAN clients.

## Expected Behavior

- On a non-loopback bind over plain HTTP, a request addressed to a loopback host gets session cookies without `Secure`; a request addressed to any other host (the LAN address) keeps `Secure`, exactly as today.
- Loopback binds keep the #600 behaviour (`false`), and an `https` `FRONTEND_BASE_URL` keeps cookies always `Secure`.
- Render and the development stack are unchanged (variable unset, always `Secure`).

## Solution

- **Backend:** a new `KERGHAN_COOKIE_SECURE` value, `loopback` (so the variable takes `true|false|loopback`). In `loopback` mode the `Secure` decision is made per request:
  - drop `Secure` only when the host the browser addressed is loopback: `localhost`, any IPv4 literal in `127.0.0.0/8`, or `[::1]`; the port is ignored, the comparison is case-insensitive and only an exact hostname match counts (`localhost.evil.com` is not loopback; `*.localhost` is not included, can be added later);
  - keep `Secure` whenever the request was originally HTTPS (`X-Forwarded-Proto: https`), and when the host is missing or malformed.
  - Setting and clearing the cookies (login, refresh, status, logout, unauthorized clears) use the same per-request decision, so the attributes always match (a `Secure` clear over plain HTTP is rejected by the browser and logout would silently fail).
  - Source of the host: `Host`; if Tent rewrites it, `X-Forwarded-Host` set by Tent. Planning verifies what Tent forwards, and that `X-Forwarded-Proto` survives Tent and cannot be supplied by the client (Tent must overwrite it).
- **Standalone client:** passes `loopback` on non-loopback binds when the effective `FRONTEND_BASE_URL` is not `https`; loopback binds keep passing `false` (a loopback bind can be reached through a user-defined name pointing to `127.0.0.1`, e.g. an `/etc/hosts` alias, which `loopback` would treat as non-loopback); `https` keeps `true`. A changed value recreates the instance on the next `kerghan up` through `settings_reason`, with a new reason such as "allowing login over plain HTTP on loopback hosts".
- **Docs:** the env var row (backend, standalone, inner stack), the `Secure`-cookie caveat in `docs/agents/standalone/release-and-caveats.md` (loopback hosts on any bind; LAN hosts still need a TLS proxy; the port-scope risk; a TLS proxy needs an `https` `FRONTEND_BASE_URL`), and the minimum image version for the fix.

### Alternatives considered

- `Origin`: rejected, not sent on every request (often absent on same-origin GETs such as status).
- Client IP: impossible (Docker gateway address in the LAN private ranges).
- `FRONTEND_BASE_URL`: rejected, instance-wide, cannot distinguish `127.0.0.1` from a LAN address.
- TLS proxy only (status quo): rejected, too much for Safari on the host itself.
- A separate variable (e.g. `KERGHAN_COOKIE_SECURE_LOOPBACK`): rejected, two interacting variables.
- `loopback` as the backend default when unset: rejected, silently changes a security default for every deployment.

### Edge cases

- `bind` set to a specific LAN IP: loopback hosts never reach the instance; the client still passes `loopback` (simple rule, no harm).
- Browsing `http://<LAN IP>:<port>` from the host itself → `Secure` as today; docs and the `up` output point to `127.0.0.1`.
- Changing `bind` with a logged-in browser (`127.0.0.1` → `0.0.0.0`): the instance is recreated as for any bind change; existing `127.0.0.1` cookies keep working.
- Tent cache: the cookie-setting responses now depend on the host; planning confirms they are never shared-cached (expected: already `X-Skip-Cache`).

### Backward compatibility

- New client with an older image (`image-tag`): a pre-#600 backend ignores the variable and a #600 backend reads `loopback` as `Secure`: no regression, just no fix until the image is updated.
- Older (#600) client with a new image: passes `true` on non-loopback binds, cookies stay `Secure` as today.
- Running instance after a client upgrade: the wanted value changes `true` → `loopback` (`running_cookie_secure` reads a missing variable as `true`), so the next `kerghan up` recreates it, keeping the data volume.
- `KERGHAN_COOKIE_SECURE` in `kerghan.env` stays refused as client-managed (#600).
- Existing Chrome/Firefox sessions on `127.0.0.1` are replaced by non-`Secure` cookies on the next login/refresh; at worst one more login.

### Security & performance

- Spoofed `Host`: only non-browser clients can send an arbitrary `Host`, and they only affect their own response. A page cannot make a victim browser send a loopback `Host` to the LAN address; under DNS rebinding the browser sends the attacker host, so cookies stay `Secure`; `SameSite=strict` and `OriginGuard` still apply.
- A cookie set for a loopback host is only sent to that host: the token never leaves the machine, even with `bind=0.0.0.0`.
- Cookies are not port-scoped (accepted, documented): other local services on `127.0.0.1` receive the cookie. Not new: #600 has the same exposure, and Chrome/Firefox already send `Secure` cookies to any `127.0.0.1` port.
- A user TLS proxy forwarding to `http://127.0.0.1:<port>` without preserving the public `Host`: guarded by the `X-Forwarded-Proto: https` rule and by the docs requiring an `https` `FRONTEND_BASE_URL` there.
- Unchanged: `httpOnly`, `SameSite=strict`, cookie paths, logging, auto-login rules. One hostname check per cookie-setting response: negligible.
- `security` agent review of the PR (spoofed `Host`, port scope, TLS-proxy case).

### Testing

- Backend specs: the mode parsing, the host classification (each loopback form, ports, case, `localhost.evil.com`, missing/malformed), the `X-Forwarded-Proto: https` override, and set/clear using the same decision.
- bats: the value passed per bind and `FRONTEND_BASE_URL`, the recreate trigger and its reason.
- Manual: Safari, Chrome and Firefox logged in over `http://127.0.0.1:<port>` on a `bind=0.0.0.0` instance, and login still failing over `http://<LAN IP>:<port>`.

### Out of scope

- Login over plain HTTP from other machines on the LAN (explicit opt-in): #603.
- TLS built into the standalone image; IPv6 `bind` addresses; changing how auto-login decides who is allowed in.

### Agent

backend, standalone, plus a `security` review.

## Benefits

Safari users can use an instance published on the LAN from the host itself, with no change for LAN clients and no new opt-in.
