# Issue: Standalone: make the advertised URL reach the instance

## Description

Part of #594. Split out of #595. This issue changes the URL the `kerghan` client advertises (and
the derived `FRONTEND_BASE_URL`) so that it actually reaches the instance. The manual
verification it was waiting on is done (see below), and its blocker #600 has shipped, so it is
ready for the normal pipeline.

## Problem

The `kerghan` client publishes the port on an IPv4 address only (`bind`, default `127.0.0.1` with
auto-login), but tells the user to use `localhost`:

- `kerghan up` prints `Kerghan is running at http://localhost:<port>` (and `already running at ...`).
- The help text (`usage`) and `standalone/config.example` say `http://localhost:<port>`.
- The default public URL is derived as `http://localhost:<port>` (`frontend_base_url_args`), and the
  wizard shows it as the default.

`localhost` resolves to `::1` first on macOS (and on many Linux hosts), where Docker does not
listen, so the request reaches whatever else holds the port. Observed on macOS with port 5000:

```
$ curl -si localhost:5000
HTTP/1.1 403 Forbidden
Server: AirTunes/935.7.1          <- macOS AirPlay Receiver

$ curl -si http://127.0.0.1:5000
HTTP/1.1 200 OK
Server: Apache/2.4.68 (Debian)    <- Kerghan (Tent)

$ lsof -nP -iTCP:5000 -sTCP:LISTEN
ControlCe  ...  IPv4  TCP *:5000 (LISTEN)
ControlCe  ...  IPv6  TCP *:5000 (LISTEN)
com.docke  ...  IPv4  TCP 127.0.0.1:5000 (LISTEN)
```

The Docker bind succeeds because the addresses differ, so nothing warns the user.

## Expected Behavior

- The URL that `kerghan up` prints, and the derived `FRONTEND_BASE_URL`, reach the Kerghan
  instance, and login works on it in Chrome, Firefox and Safari.
- A `FRONTEND_BASE_URL` set by the user in `kerghan.env` is never changed.

## Solution

### Verification (done)

- **V1 (login over plain HTTP, standalone 0.10.2):** Chrome and Firefox kept the login on
  `http://127.0.0.1:<port>`. Safari did not, even on `http://localhost:<port>`, because it rejects
  the `Secure` cookie over plain HTTP on any host. That was fixed separately:
  - #600: a loopback `bind` drops `Secure` (`KERGHAN_COOKIE_SECURE=false`);
  - #601: a non-loopback `bind` drops it per request for a loopback `Host`
    (`KERGHAN_COOKIE_SECURE=loopback`).

  Login now works on `http://127.0.0.1:<port>` in all three browsers.
- **V2 (IPv6 loopback publish):** not needed once V1 passes, so it was not run.

### Chosen: option A — advertise the bind address

The advertised URL becomes `http://<bind>:<port>` instead of `http://localhost:<port>`, with this
rule per `bind` value (implemented once, in `advertised_url`):

| `bind` | Printed URL | Reaches the instance | Login over plain HTTP |
|---|---|---|---|
| `127.0.0.1` (default) | `http://127.0.0.1:<port>` | yes | yes (`KERGHAN_COOKIE_SECURE=false`, #600) |
| other loopback `127.x.y.z` | `http://127.x.y.z:<port>` | yes | yes (same rule) |
| `0.0.0.0` or empty | `http://127.0.0.1:<port>` | yes (always reachable locally) | yes (`loopback` mode, loopback `Host`, #601) |
| specific non-loopback IP, e.g. `192.168.1.5` | `http://192.168.1.5:<port>` | yes (`127.0.0.1` would not: Docker publishes only on that IP) | no: the cookie is `Secure` there |

- Specific non-loopback IP: no plain-HTTP URL both reaches the instance and keeps the login, so
  the client prints the bind address (where the instance actually is); the existing
  `plain_http_lan_hint` line right after it already says plain-HTTP login fails there and points
  to the TLS reverse proxy docs. No new message.
- `plain_http_lan_hint` for `0.0.0.0` stops saying `on this host use http://localhost:$port` and
  names the advertised URL instead.
- `kerghan diagnose`: when the advertised URL equals the published-address probe URL (every case
  above), it does not probe twice; it prints `[ok] advertised URL is the published address`
  instead. Exit code 6 (advertised URL broken) stays for when they ever differ.
- A user-set `FRONTEND_BASE_URL` (e.g. an `https` reverse-proxy URL) does not change the printed
  URL: the client prints the address it published, not a proxy it does not control (`diagnose`
  already reports that value as `[info]`).
- Remote engine (`DOCKER_HOST=tcp://...` or `ssh://...`): `127.0.0.1` is the remote host's
  loopback. Unchanged known limitation (`localhost` had the same one).

### Alternatives considered

- **B. Also publish on IPv6 loopback** (`-p [::1]:<port>:80`) and keep advertising `localhost`.
  Not chosen: it needs Docker IPv6 publish support (unverified on Docker Desktop for macOS, since
  V2 was never run; on Linux it depends on the daemon's IPv6 config), it doubles the published
  addresses and the conflict surface, and it still loses to a process that holds `[::1]:<port>`
  or `*:<port>` on IPv6 first (AirPlay holds both).
- **A′. Keep `localhost`** and only name the published address in the `up` line, relying on #595's
  warning. Not chosen: the printed URL would still be one that can reach another service, and its
  fallback condition (A failing V1) no longer applies after #600 and #601.
- **Advertise the user's `FRONTEND_BASE_URL`** when set. Not chosen: the client would vouch for a
  proxy it does not control (see the per-`bind` rule above).

### Scope

Client code (`standalone/bin/kerghan`):

- `usage`: `up` starts Kerghan on `http://127.0.0.1:$DEFAULT_PORT` (the default bind).
- `advertised_url`: the per-`bind` rule above; its comment drops "Today it is localhost / #598 may
  change that".
- `frontend_base_url_args`, `effective_frontend_base_url`: take `<bind> <port>` (below).
- `plain_http_lan_hint` (`0.0.0.0`): names the advertised URL.
- `warn_port_conflict`: the second line stays (a user may still type `localhost`), with a
  concrete example: `Kerghan is published on $bind:$port only; other addresses (such as
  localhost:$port) may reach that process instead`. The ControlCenter comment stays.
- Wizard: the Public URL default (below).
- `cmd_diagnose`: skips the second probe when the advertised URL equals the published address.

Other files:

- `standalone/config.example`: `(http://127.0.0.1:<port> with the default bind)`.
- `standalone/scripts/smoke_test.sh`, `standalone/scripts/verify_client_ip.sh`: default to
  `http://127.0.0.1:<port>`.
- `README.md`: the `kerghan up` example.
- Docs (`docs/agents/`): `standalone/client.md` (synopsis, the `vault up` line, the derived URL,
  the LAN hint and the conflict warning text), `standalone/config-files.md` (reverse the recorded
  decision), `standalone/client-config/files.md`, `standalone/client-config/wizard.md`,
  `standalone/client-update/command.md` (sample output), `standalone/inner-stack.md` (derived
  URL and `OriginGuard`, `e2e` `BASE_URL` default), `standalone/https.md` (both hosts stay valid
  on the host; "points to localhost" becomes the advertised URL), `standalone/release-and-caveats.md`
  (the AirPlay caveat notes that since #598 only a hand-typed `localhost` hits it),
  `environment-variables/standalone.md` (derived default), `standalone/client-diagnose.md` (the
  advertised-URL check skips the duplicate probe).

Not in scope: the dev stack URLs in `README.md` (`localhost:3000/3030/3010`) and every other
`localhost` under `docs/agents` (navi, vault, backend env, OAuth/GitHub App config), which are
not the standalone advertised URL; #595's AirPlay hint text.

### Derived `FRONTEND_BASE_URL`

- `frontend_base_url_args` and `effective_frontend_base_url` take `<bind> <port>`; their derived
  default is `advertised_url "$bind" "$port"`, so the derived `FRONTEND_BASE_URL` always equals
  the printed URL (one rule, one place). Callers updated: `up_instance`, `wanted_cookie_secure`,
  `proxy_auto_login_warning` (all already have the bind).
- Wizard: the Bind address question comes before Public URL, so the wizard keeps its answer
  (`WIZARD_BIND`, like `WIZARD_PORT`) and the default reads
  `http://<advertised host>:<port>, derived from bind and port`.

### Recreate behaviour

No new recreate trigger:

- The derived `FRONTEND_BASE_URL` depends only on `bind` and `port`, which already recreate
  (`settings_reason` / `recreate_reason`).
- A client upgrade changes the wanted image (`KERGHAN_VERSION`), which recreates, so the instance
  picks up the new derived URL.
- Accepted gap: with `image-tag` pinned in `~/.kerghan/config` and the same bind and port, a client
  upgrade does not recreate, so the instance keeps `FRONTEND_BASE_URL=http://localhost:<port>`
  while `up` prints `http://127.0.0.1:<port>`. This is harmless: in standalone the backend uses
  that value only for same-origin-tolerant CSRF, disabled password-reset emails and OAuth/GitHub
  App types (which require an `https` URL the user sets), and the client reads only its scheme
  (`wanted_cookie_secure`, `proxy_auto_login_warning`), which does not change. It heals at the
  next recreate for any reason. Comparing the running value would restart the inner stack for
  nothing visible.

### Edge cases

- A user-set `FRONTEND_BASE_URL` in `kerghan.env` is never rewritten; only the derived default changes.
- Per-`bind` URL rule, the non-loopback bind and the remote engine: see the table above.

### Backward compatibility

Switching the derived `FRONTEND_BASE_URL` from `localhost` to the bind address is safe:

- CSRF (`OriginGuard`): same-origin requests always pass (`Sec-Fetch-Site: same-origin`, or Origin equal to Host).
- CORS: the frontend is served from the same origin through Tent.
- Password-reset links: emails are disabled in standalone (`KERGHAN_EMAILS_ENABLED=false`).
- OAuth / GitHub App callbacks: standalone runs with `NODE_ENV=production`, which requires an
  `https` `FRONTEND_BASE_URL` for those types, so their users already set it explicitly.

For existing users:

- **Session cookie:** `localhost` and `127.0.0.1` are different cookie hosts, so the first visit
  on the new URL has no session. With auto-login on (the default) nothing is visible: every
  request is authenticated as admin. With auto-login off, the user logs in once. No data is tied
  to the URL.
- **`localhost` bookmarks** keep working in the common case: with nothing on `::1:<port>`, the
  browser falls back to `127.0.0.1`, and the old session there stays valid. They only break in
  the case this issue fixes. Nothing to migrate.
- **The `up` messages** (`Kerghan is running at ...`, `already running at ...`) change. They are
  messages, not an interface; scripts parsing them may break, so the release notes mention it.
  bats tests asserting them are updated (`bind`, `update`, `recreate_settings`, `args`,
  `upgrade`, `lan_https`, `config`).
- **Recorded decision:** `docs/agents/standalone/config-files.md` states that the user-facing URL
  stays `http://localhost:<port>` with any bind. That decision is reversed (with a pointer to
  this issue), not silently edited.
- **Older images:** with `image-tag` pinned before #601 and `bind=0.0.0.0`, plain-HTTP login fails
  on `localhost` and `127.0.0.1` alike, so this is no regression.
- **CI scripts:** `standalone/scripts/smoke_test.sh` and `standalone/scripts/verify_client_ip.sh`
  default to `http://localhost:<port>`; they switch to `http://127.0.0.1:<port>` so CI exercises
  the advertised URL. Neither parses the `up` message.

### Security & performance

- **No new exposure:** `bind` and the `-p <bind>:<port>:80` publish are unchanged; only a printed
  string and a derived env value change.
- **Risk removed:** the printed URL no longer can lead the user to another process on the same
  port (with auto-login off, they could type the admin password into whatever answers
  `localhost`).
- **Cookie `Secure` unchanged:** `wanted_cookie_secure` reads only the URL scheme, still `http`
  for the derived URL, so `KERGHAN_COOKIE_SECURE` stays `false` on loopback and `loopback`
  otherwise: no weaker cookies, and no spurious recreate from `settings_reason`.
- **`OriginGuard`:** the trusted origin becomes the instance's own published origin, so nothing
  beyond same-origin is trusted; `localhost` browsing still passes the same-origin rule.
- **Input:** the URL is built from the already-validated `bind` (dotted IPv4) and `port`
  (1-65535); no new parsing or injection surface.
- **Performance:** negligible; `kerghan diagnose` makes one HTTP probe fewer.

### Out of scope

- IPv6 `bind` addresses: the `bind` setting stays IPv4-only.
- The port conflict warning and the macOS AirPlay docs (#595).

### Testing

- bats tests in `standalone/test/` for the printed URL per `bind` value and the derived
  `FRONTEND_BASE_URL` (with and without a user-set value).
- `KERGHAN_COOKIE_SECURE` is unchanged per `bind`, and an instance running with the old
  `localhost` derived URL is not recreated when nothing else changed.
- `kerghan diagnose` does not probe the advertised URL twice when it equals the published address.
- Existing tests asserting `http://localhost:<port>` are updated.

### Agent

standalone.

## Benefits

- The URL Kerghan gives out actually reaches Kerghan, instead of a 403 from an unrelated service,
  without breaking login.
