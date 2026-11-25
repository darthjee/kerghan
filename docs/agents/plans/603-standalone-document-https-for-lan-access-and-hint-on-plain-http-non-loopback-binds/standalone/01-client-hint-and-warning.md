# Client hint and warning

Add two output-only checks to `standalone/bin/kerghan`, shared by `kerghan up` and (for the
warning) `kerghan configure`.

## Docs URL constant

Add near the other top-level constants:

```bash
HTTPS_DOCS_URL="https://github.com/darthjee/kerghan/blob/main/docs/agents/standalone/https.md"
```

## `plain_http_lan_hint <bind> <port>`

Prints nothing unless `wanted_cookie_secure "$bind" "$port"` is `loopback` (reuse it — do not
re-derive the condition, so the hint and the cookie behaviour cannot drift). Otherwise one `hint`:

- `bind=0.0.0.0`:
  `other machines cannot log in over plain HTTP; on this host use http://localhost:<port>, from the LAN put a TLS reverse proxy in front and set an https FRONTEND_BASE_URL (see $HTTPS_DOCS_URL)`
- any other (non-loopback, specific LAN IP) bind:
  `logging in over plain HTTP fails on <bind>; put a TLS reverse proxy in front and set an https FRONTEND_BASE_URL (see $HTTPS_DOCS_URL)`

## `proxy_auto_login_warning <auto_login> <bind> <port>`

Prints nothing unless `auto_login` is `true`, `is_loopback "$bind"`, and
`effective_frontend_base_url "$port"` starts with `https://`. Otherwise:

```text
warn  "automatic login is on and FRONTEND_BASE_URL is <url>: if a reverse proxy publishes Kerghan, anyone who can reach it is logged in as admin"
hint  "use 'kerghan up --no-auto-login' or set auto-login=false in ~/.kerghan/config"
```

(On a non-loopback bind the existing "published on $bind" warning already covers auto-login.)

## Wiring in `cmd_up`

Right after the existing auto-login-on-non-loopback warning block (after `bind` is resolved and
`auto_login` holds the **effective** value, i.e. after the no-default-user fallback to `false`),
and before "# 3. Compare with the running instance":

```bash
proxy_auto_login_warning "$auto_login" "$bind" "$port"
plain_http_lan_hint "$bind" "$port"
```

This placement gives the required order (auto-login warnings → plain-HTTP hint → port-conflict
warning from step 4), prints on the "already running" no-op path too, and runs before the instance
starts, so it is visible with `up -f`. Confirm `port` is already resolved at that point; move the
calls just after its resolution if not, keeping the order.

## Wiring in `cross_key_warnings` (configure)

After the existing auto-login-on-non-loopback check, add the proxy warning only (the plain-HTTP
hint is **not** shown by `configure`):

```bash
setting_lookup port
proxy_auto_login_warning "$auto_login" "$bind" "$SETTING_VALUE"
```

Use the same `auto_login`/`bind` values the function already looked up. If `port` has a default
when unset, make sure `setting_lookup port` returns the effective value (check how
`setting_lookup` resolves defaults). `effective_frontend_base_url` reads `kerghan.env`, which
`configure` has already written by the time `cross_key_warnings` runs; when the file does not
exist it falls back to the `http://localhost` default, so no warning.

## Files to Change

- `standalone/bin/kerghan` — `HTTPS_DOCS_URL`, `plain_http_lan_hint`, `proxy_auto_login_warning`,
  calls in `cmd_up` and `cross_key_warnings`, and the header comment of `cross_key_warnings`
  (mention the new warning).
