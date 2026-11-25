# Issue: Safari cannot stay logged in to a standalone instance over plain HTTP

## Problem

The session cookies (`access_token`, `refresh_token`, `logged_in`) are always set with `Secure`
(`backend/src/auth/auth-cookies.ts`, `BASE_OPTIONS = { secure: true, sameSite: 'strict' }`).
A standalone instance is served over plain HTTP by default, and Safari drops `Secure` cookies over
`http://` **even on `localhost`**, so a Safari user's login never sticks.

Verified on standalone `0.10.2` (log in, then refresh; private windows included):

| URL | Firefox | Chrome | Safari |
|---|---|---|---|
| `http://127.0.0.1:5000` | pass | pass | **fail** |
| `http://localhost:5050` (free port) | — | — | **fail** |

`docs/agents/standalone/release-and-caveats.md` (Caveats → HTTPS) says browsers accept the cookie
on `http://localhost`; that is wrong for Safari.

## Expected Behavior

On a standalone instance published on a loopback bind (the default `127.0.0.1`) and served over plain HTTP, logging in works and survives a refresh in Safari, Chrome and Firefox, on both `http://127.0.0.1:<port>` and `http://localhost:<port>`. Every other deployment (Render, LAN binds, TLS-fronted instances) keeps `Secure` cookies.

## Solution

**The client decides; the backend reads a flag.**

- **Backend:** a new `KERGHAN_COOKIE_SECURE` setting (`true`/`false`, default `true`) drives the
  `secure` option of all three session cookies in `backend/src/auth/auth-cookies.ts`, for both
  setting and clearing them (one shared source). No standalone-specific logic in the backend.
- **Client (`standalone/bin/kerghan`):** passes `KERGHAN_COOKIE_SECURE=false` only when `bind` is a
  loopback address **and** `FRONTEND_BASE_URL` (user-set in `kerghan.env`, or the derived default)
  is not `https`; otherwise passes `true`. Recreate trigger and client-managed key as described in
  [Backward compatibility](#backward-compatibility).
- **Inner stack:** `standalone/vault/docker-compose.yml` passes it through to the `kerghan` service.
- **Docs:** fix the HTTPS caveat in `docs/agents/standalone/release-and-caveats.md` (Safari, loopback
  vs LAN, TLS proxy route) and the standalone docs repeating it; document the new backend variable.

#### Alternatives considered

| Option | Verdict |
|---|---|
| **1. Client decides, backend reads a flag** | **Chosen**: the client knows the bind and `FRONTEND_BASE_URL`; the backend stays generic; Render untouched; follows the auto-login pattern. |
| 2. Backend derives it from the `FRONTEND_BASE_URL` scheme | Rejected: the backend cannot see the bind, so it would also drop `Secure` on LAN binds (out of scope). |
| 3. Per request (`X-Forwarded-Proto` / client address) | Rejected for now: needs Tent to forward the protocol and proxy trust in the backend; may return for the LAN follow-up. |
| 4. Built-in HTTPS (self-signed / `mkcert`) | Rejected: browser warnings or a local CA install; much heavier setup. |
| 5. Do nothing, document that Safari needs TLS | Rejected: Safari is the macOS default browser; standalone would be broken out of the box. |

### Scope

**In scope**

- All three session cookies (`access_token`, `refresh_token`, `logged_in`) on a standalone instance
  served over plain HTTP **on a loopback bind** (`bind` is a loopback address; the default
  `127.0.0.1`). Loopback traffic never leaves the host, so `Secure` protects nothing there.
- The client turns this on automatically for loopback binds; no user configuration.
- Fixing the HTTPS caveat in `docs/agents/standalone/release-and-caveats.md` (and the standalone
  docs repeating it).

**Out of scope**

- Non-loopback binds (`bind=0.0.0.0`, a LAN IP): cookies stay `Secure`, so plain-HTTP login over
  the LAN keeps failing, as today. The caveat says so: use the default loopback bind, or a TLS
  reverse proxy. Because the cookie setting applies to the whole instance, a Safari user browsing
  `127.0.0.1` on a `bind=0.0.0.0` instance is also still affected; documented.
  **Follow-up issue #601:** allow plain-HTTP login over the LAN behind an explicit opt-in
  configuration.
- Render and every other deployment: cookies stay `Secure`, and that stays the default.
- The development docker-compose stack.
- Built-in TLS in standalone.
- `SameSite` (stays `strict`).
- The advertised URL (#598, unblocked by this issue).

### Edge cases

1. **TLS proxy in front of a loopback bind** (user-set `https` `FRONTEND_BASE_URL` in
   `kerghan.env`): cookies keep `Secure`. Rule: cookies drop `Secure` only when the bind is a
   loopback address **and** `FRONTEND_BASE_URL` is not `https`.
2. **Existing sessions on upgrade**: Chrome/Firefox users hold `Secure` cookies; the next login or
   refresh replaces them with non-`Secure` ones of the same name (browsers treat
   `localhost`/`127.0.0.1` as secure, so the overwrite should be allowed). Tested explicitly
   (refresh and logout after an upgrade); the acceptable worst case is one extra login, never a
   session that cannot be cleared.
3. **Logout**: `clearSessionCookies` must use the same `Secure` decision as `setSessionCookies`,
   from one shared source, so browsers actually drop the cookies.
4. **Bind changed between loopback and non-loopback**: already a recreate trigger, so the setting
   follows. Old non-`Secure` cookies stay scoped to the loopback host and are never sent to a LAN
   address.
5. **Client/image version mismatch**: newer client + older image (`image-tag`) → the backend ignores
   the unknown setting, cookies stay `Secure`, nothing breaks; older client + newer image → the
   setting is not passed, cookies stay `Secure`. The backend default is always `Secure`.
6. **`localhost` vs `127.0.0.1`** are different cookie hosts: logging in on one does not log in the
   other. Expected; mentioned in the docs (relevant once #598 changes the advertised URL).
7. **Auto-login** already requires a loopback bind and uses the same cookie code: covered.

### Backward compatibility

1. **Render, the development stack and other deployments**: unchanged; the variable is not set, so
   cookies stay `Secure`.
2. **Existing standalone instances**: the cookie setting joins the recreate triggers, following the
   auto-login pattern (`running_auto_login` / `settings_reason`). A `running_cookie_secure` helper
   reads it from the container: missing → `true` (instance created by an older client), failed
   inspect → `unknown` (always recreates). When it differs from the wanted value, `kerghan up`
   recreates the instance (data volume kept) with a reason such as
   `allowing login over plain HTTP on loopback`. After upgrading, one `kerghan up` fixes Safari; a
   client upgrade changes the image anyway, so it is the same recreate in practice.
3. **`FRONTEND_BASE_URL` changed in `kerghan.env`** on a running instance: today `kerghan.env` edits
   never recreate (existing limitation). With trigger 2, switching that URL between `http` and
   `https` changes the wanted cookie setting, so the next `up` recreates. Recreating on other
   `kerghan.env` edits stays out of scope.
4. **Client-managed key**: `KERGHAN_COOKIE_SECURE` joins `refuse_client_managed_keys`; a
   `kerghan.env` setting it is refused with a hint (like the auto-login keys). To keep `Secure`,
   put TLS in front and set an `https` `FRONTEND_BASE_URL` (edge case 1).
5. **Inner stack**: `standalone/vault/docker-compose.yml` passes the variable through to the
   `kerghan` service (like `FRONTEND_BASE_URL`). An older image without it ignores it (edge
   case 5).
6. **Existing browser sessions**: edge case 2 (worst case, one extra login).

### Testing

- **Backend (Jest):** cookies `Secure` by default and with the flag `true`; not `Secure` with
  `false`; logout clears them with the same setting.
- **Client (bats):** the flag value for a loopback bind + `http` URL (`false`), a loopback bind +
  user-set `https` URL (`true`), `bind=0.0.0.0` and a LAN IP (`true`); the recreate when the setting
  differs (including an instance from an older client with no variable); a `kerghan.env` setting the
  key is refused.
- **Manual, recorded in the PR:** Safari, Chrome and Firefox — log in on `http://127.0.0.1:<port>`
  and `http://localhost:<port>`, refresh, log out; upgrade from 0.10.2 with an existing Chrome
  session.

### Performance & security

- **Performance:** nothing relevant.
- **Security:** without `Secure`, the cookies stay `HttpOnly` (except `logged_in`, which holds no
  secret) and `SameSite=strict`. On loopback, traffic never leaves the host, so the risk does not
  change: a process on the same machine could already read loopback traffic or the browser
  profile. The default stays `Secure`. Docker Engine before 28 on Linux exposing `127.0.0.1` ports
  to the LAN (existing caveat) only affects who can reach the port; the browser's own traffic to
  `127.0.0.1` stays on the host, so the cookies are not exposed. Request a `security` agent review.

### Related

- Blocks #598: once cookies work over plain HTTP on loopback in every browser, #598 can go with
  option A (advertise the bind address, `http://127.0.0.1:<port>`). Results posted in
  https://github.com/darthjee/kerghan/issues/598#issuecomment-7158436137.
- Part of the standalone observability/reachability work in #594.

### Agents

backend (cookie options), standalone (client sets the flag, docs), plus a `security` review.
