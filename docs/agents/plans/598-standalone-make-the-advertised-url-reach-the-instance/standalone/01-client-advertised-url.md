# Client: advertised URL and derived FRONTEND_BASE_URL

All changes in `standalone/bin/kerghan`.

1. **`advertised_url <bind> <port>`**: return `http://$(published_probe_host "$1"):$2`
   (`127.0.0.1` for `''`/`0.0.0.0`, the bind itself otherwise, loopback or not). Rewrite its
   comment: it is the shared contract for `up`, the derived `FRONTEND_BASE_URL`, the wizard
   default and `diagnose`; drop "Today it is http://localhost:<port> ... (#598 may change that)".
   If `published_probe_host` is defined after `advertised_url`, that is fine in bash (resolved at
   call time); keep both next to each other.
2. **`frontend_base_url_args <bind> <port>`** and **`effective_frontend_base_url <bind> <port>`**:
   take the bind as first argument; the derived default is `advertised_url "$1" "$2"`. Behaviour
   with a user-set `FRONTEND_BASE_URL` is unchanged. Update the callers:
   - `up_instance` (`done < <(frontend_base_url_args "$port")`): pass its bind.
   - `wanted_cookie_secure <bind> <port>`: `effective_frontend_base_url "$1" "$2"`.
   - `proxy_auto_login_warning <auto_login> <bind> <port>`: pass `"$2" "$3"`.
   - Any other caller found by `grep -n "effective_frontend_base_url\|frontend_base_url_args"`.
   Only the scheme is read by the cookie/proxy logic, so `KERGHAN_COOKIE_SECURE` values do not
   change for any bind.
3. **`plain_http_lan_hint`** (`bind=0.0.0.0` branch): replace `on this host use
   http://localhost:$port` with `on this host use $(advertised_url "$bind" "$port")`. The
   specific-address branch is unchanged (it already says plain-HTTP login fails on `$bind`).
4. **`warn_port_conflict`** second line: `Kerghan is published on $bind:$port only; other
   addresses (such as localhost:$port) may reach that process instead`. Keep the ControlCenter
   comment above the function.
5. **`usage`**: the `up` line says `start Kerghan (detached by default) on
   http://127.0.0.1:$DEFAULT_PORT`.
6. **Wizard**: after `wizard_config_question bind "Bind address"`, keep the answer in
   `WIZARD_BIND="$WIZARD_VALUE"` (declare `WIZARD_BIND=""` next to `WIZARD_PORT=""`). The Public
   URL default becomes `"$(advertised_url "$WIZARD_BIND" "$WIZARD_PORT"), derived from bind and
   port"`.
7. **`cmd_diagnose`** (probes section): when `adv_hostport` equals `pub_hostport` (the
   `if [ "$adv_hostport" != "$pub_hostport" ]` test), add an `else` branch printing
   `diag_line "[ok]" "advertised URL is the published address"`, so the user sees the second
   check was satisfied without a second request. The exit-6 branch stays as is.
8. **`up` messages** (`Kerghan is running at ...`, `already running at ...`) already go through
   `advertised_url`: no change needed beyond step 1; verify with grep that no other
   `http://localhost` literal remains in the client (`grep -n "localhost" standalone/bin/kerghan`
   should only show the conflict-warning example and comments about `localhost` resolution).

## Files to Change

- `standalone/bin/kerghan` — `advertised_url`, `frontend_base_url_args`,
  `effective_frontend_base_url` and their callers, `plain_http_lan_hint`, `warn_port_conflict`,
  `usage`, wizard (`WIZARD_BIND`, Public URL default), `cmd_diagnose` probes.
