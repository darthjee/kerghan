# bats coverage

Add a new file `standalone/test/lan_https.bats` (load `helpers/setup`, reuse `write_config`,
`write_env_file`, `vault_calls`, `up_line`-style helpers as `bind.bats` / `cookie_secure.bats` do)
and update existing tests whose exact stderr changes.

## Plain-HTTP hint (`kerghan up`)

- `--no-auto-login --bind 0.0.0.0` → output contains
  `kerghan: hint: other machines cannot log in over plain HTTP; on this host use http://localhost:3000` and the docs URL.
- `-p 8080 --bind 0.0.0.0` → the `localhost` pointer uses port `8080`.
- `--no-auto-login --bind 192.168.1.10` → contains `logging in over plain HTTP fails on 192.168.1.10`
  and no `localhost` pointer.
- Default loopback bind and `bind=127.0.0.2` → no hint.
- Non-loopback bind with `FRONTEND_BASE_URL=https://…` in `kerghan.env` → no hint.
- Non-loopback bind with `FRONTEND_BASE_URL=http://192.168.1.10:3000` → hint shown.
- "Already running" path (stub a running instance with a matching `KERGHAN_COOKIE_SECURE=loopback`,
  as `cookie_secure.bats` / `recreate_settings.bats` do) → hint shown, stdout still says
  "Kerghan is already running at …".
- Order: with auto-login on and `--bind 0.0.0.0`, the existing auto-login warning line comes before
  the hint line; with a port conflict stub (see `port_conflict.bats`), the hint comes before the
  port-conflict warning.

## Auto-login behind a proxy warning

- `up` with auto-login on, loopback bind, `FRONTEND_BASE_URL=https://kerghan.local:8443` →
  contains `kerghan: warning: automatic login is on and FRONTEND_BASE_URL is https://kerghan.local:8443`
  and the `--no-auto-login` / `auto-login=false` hint; the instance still starts (exit 0).
- Not shown: auto-login off; auto-login falling back to off because `kerghan.env` has no default
  user; `http` URL; non-loopback bind (only the existing warning).
- `configure` (e.g. `kerghan configure auto-login=true` with an `https` `FRONTEND_BASE_URL` in
  `kerghan.env`, and `kerghan configure FRONTEND_BASE_URL=https://…` with auto-login on) → the
  warning is printed; with an `http` URL it is not. `configure` never prints the plain-HTTP hint.

## Existing tests

Run the whole suite and update tests that assert the exact stderr/output of `up` on non-loopback
binds (likely `bind.bats`, `port_conflict.bats`, `cookie_secure.bats`, `recreate_settings.bats`,
`auto_login.bats`). Prefer `assert_output_contains` over loosening unrelated assertions; checks of
the form `[[ "$output" != *warning* ]]` stay valid since the plain-HTTP line is a `hint`.

## Files to Change

- `standalone/test/lan_https.bats` — new tests above.
- `standalone/test/bind.bats`, `standalone/test/port_conflict.bats`,
  `standalone/test/cookie_secure.bats` (and any other failing file) — adjust for the new hint line.
