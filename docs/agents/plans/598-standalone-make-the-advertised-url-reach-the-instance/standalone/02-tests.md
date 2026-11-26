# Tests

bats tests in `standalone/test/`, run with `docker-compose run --rm standalone_tests` and
`docker-compose run --rm standalone_tests_bash32`.

1. **Update existing assertions** on `http://localhost:<port>` to the new URL in the files that
   assert it: `bind.bats`, `update.bats`, `recreate_settings.bats`, `args.bats`, `upgrade.bats`,
   `lan_https.bats`, `config.bats`, `frontend_base_url.bats`, `auto_login.bats`,
   `cookie_secure.bats`, `wizard.bats` (`Public URL [http://127.0.0.1:3000, derived from bind and
   port]`), `port_conflict.bats` (the `localhost:$port` example), `diagnose.bats`.
2. **Printed URL per bind** (in `bind.bats` or a new `advertised_url.bats`): `kerghan up` prints
   `Kerghan is running at http://127.0.0.1:<port>` for the default bind, `--bind 127.0.0.2` prints
   `http://127.0.0.2:<port>`, `--bind 0.0.0.0` prints `http://127.0.0.1:<port>`, a LAN bind such as
   `--bind 192.168.1.5` prints `http://192.168.1.5:<port>` (followed by the existing plain-HTTP
   hint). Same for `already running at ...` (stub `STUB_RUNNING_HOST_IP`).
3. **Derived `FRONTEND_BASE_URL`** (`frontend_base_url.bats`): the `vault up` call carries
   `-e FRONTEND_BASE_URL=http://<advertised host>:<port>` per bind; with `FRONTEND_BASE_URL` set
   in `kerghan.env` no `-e FRONTEND_BASE_URL` is passed and the printed URL is still the published
   address.
4. **Cookie setting unchanged and no spurious recreate** (`cookie_secure.bats` /
   `recreate_settings.bats`): `KERGHAN_COOKIE_SECURE` is `false` for loopback binds and
   `loopback` for `0.0.0.0` / LAN binds, as before; a running instance whose env still has
   `FRONTEND_BASE_URL=http://localhost:<port>` (same image, port, bind, auto-login, cookie
   setting) is not recreated (`already running at http://127.0.0.1:<port>`, no `vault down`).
5. **`plain_http_lan_hint`** (`lan_https.bats`): with `--bind 0.0.0.0` the hint names
   `http://127.0.0.1:<port>`, not `localhost`.
6. **Diagnose** (`diagnose.bats`): the healthy case prints `[ok]   http://127.0.0.1:3000/health.json`
   and `[ok]   advertised URL is the published address`, and makes exactly one `/health.json`
   request. Rewrite the existing exit-6 cases (AirPlay / foreign service / no answer on the
   advertised URL): with the advertised URL now equal to the published address, the
   "localhost answered by AirPlay" scenario becomes a healthy run (exit 0) when Kerghan answers
   on `127.0.0.1`; keep the exit-5 cases for the published address itself. Remove the
   `STUB_RUNNING_HOST_IP=localhost` setup if it only served the old exit-6 path.
7. **Completion sync** is unaffected (no new command or flag).

## Files to Change

- `standalone/test/*.bats` listed above — updated and new assertions.
- `standalone/test/stubs/curl` — only if a diagnose test needs a new per-host response (it already
  keys responses per host, e.g. `127_0_0_1`).
