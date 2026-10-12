# standalone.md

Create `docs/agents/specs/default-user/standalone.md` (implemented by #371 and #372).

- **Pass-through.** Every `KERGHAN_DEFAULT_USER_*` variable is added to the app's list in `standalone/vault/docker-compose.yml`.
- **New installations.** `ensure_env_file` writes:
  - `ENABLED=true`
  - `USERNAME=admin`
  - `EMAIL=admin@kerghan.local`
  - `PASSWORD=<generated>` (32+ random characters)
  - `ADMIN=true`

  Show this with a placeholder example only.
- **`auto-login`.** A `~/.kerghan/config` setting, `auto-login=true|false`, default `true`, plus `kerghan up --auto-login` / `--no-auto-login`.
  - Precedence: flag, then config, then default.
  - The client translates the value into `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`.
  - A changed value recreates the instance on the next `up`, keeping the data volume.
- **`bind`.** A `bind=<address>` setting plus `--bind ADDRESS`, with the same precedence. The default is `127.0.0.1` when automatic login is on and `0.0.0.0` when it is off. Today the client uses `-p "$port:80"`, which publishes on all interfaces.
- **Open risk (#371).** The effective client IP of a host request after Vault, then Tent, then the backend is not confirmed (it is probably a Docker gateway address). #371 confirms it and sets `ALLOWED_IPS` (and proxy trust, if needed), then updates this file.
- **Existing installations (#372).** Upgrades do not modify an existing `kerghan.env`. A new client command (name decided in #372) appends only the missing keys, keeps mode 600 and the existing values, reports what it added, is idempotent, and tells the user to restart.

**Required tests (bats):**
- the generated values;
- `auto-login` and `bind` resolution, precedence, and recreation on change;
- a fresh installation logged in from the host but not reachable from other interfaces by default;
- update-command cases: missing file, up-to-date, partially missing, values and mode preserved, idempotent.

## Files to Change
- `docs/agents/specs/default-user/standalone.md`: new.
