# auto-login and bind settings, flags and vault args

Add the two settings and pass the resulting values to `vault up`.

- Config (`load_config`): new globals `CFG_AUTO_LOGIN` and `CFG_BIND`, reset at the top like the others.
  - `auto-login`: empty or `true|false`. Otherwise `config_invalid ... "true or false"`.
  - `bind`: empty or a valid IPv4 address (a `valid_bind` helper: four dot-separated 0-255 octets). Docker also accepts IPv6 host IPs, so decide whether to accept a bracket-free IPv6 such as `::1`. If not, document that only IPv4 is supported. Otherwise `config_invalid ... "an IPv4 address"`.
- Flags (`cmd_up`): `--auto-login` / `--no-auto-login` (the last one wins), and `--bind ADDRESS` (requires a value, validated like `-p` with `usage_error`).
- Resolution, before any side effect: `auto_login = flag > CFG_AUTO_LOGIN > true`. `bind = flag > CFG_BIND > (127.0.0.1 if auto_login is true, else 0.0.0.0)`.
- Warning: when `auto_login` is true and `bind` is not a loopback address (anything outside `127.0.0.0/8`, and not `::1` if IPv6 is accepted), print `warn "automatic login is on and the port is published on $bind: anyone who can reach it is logged in as admin"` plus a `hint` to use `--no-auto-login` or `bind=127.0.0.1`. Then continue.
- `up_instance`: take `bind` and `auto_login` as extra parameters. Publish with `-p "$bind:$port:80"`. Always add `-e KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=<true|false>` and `-e KERGHAN_DEFAULT_USER_ALLOWED_IPS=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16` (a constant near the other defaults, e.g. `DEFAULT_USER_ALLOWED_IPS`, narrowed in step 05 if the effective IP is stable). Confirm with the vault stub or `vault --help` that `-e` given after `--env-file` takes precedence (Docker semantics). This is what makes the client win over `kerghan.env`.
- Keep the user-facing URL message as `http://localhost:$port`. When `bind` is non-loopback, that URL still works from the host.
- Check the port-conflict hint logic (`port.bats`) still matches when Vault's error mentions `127.0.0.1:<port>` instead of `0.0.0.0:<port>`.
- Tests: new `standalone/test/auto_login.bats` and `standalone/test/bind.bats` (or extend `config.bats` / `args.bats` where the existing pattern fits):
  - default `-e KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true` and `-p 127.0.0.1:3000:80`;
  - `auto-login=false` in config gives `false` and `-p 0.0.0.0:3000:80`;
  - flag over config in both directions;
  - explicit `bind` over the auto-login-derived default;
  - invalid config values fail with the line number, and invalid flags give a usage error;
  - `KERGHAN_DEFAULT_USER_ALLOWED_IPS` is always passed, and the `-e` values come after `--env-file` even when `kerghan.env` sets them;
  - the warning appears for auto-login with `bind=0.0.0.0` and not otherwise.

  Update existing assertions that expect `-p 3000:80` or similar.

## Files to Change
- `standalone/bin/kerghan` — config keys, flags, resolution, warning, `up_instance` args.
- `standalone/test/config.bats`, `standalone/test/args.bats`, `standalone/test/port.bats` — updated expectations.
- `standalone/test/auto_login.bats`, `standalone/test/bind.bats` — new tests.
