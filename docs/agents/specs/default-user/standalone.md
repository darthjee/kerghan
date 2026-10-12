# Standalone

Implemented by #371 (wiring, `auto-login`, `bind`) and #372 (update command). Part of the
[default-user specs](README.md).

## Today

- The client generates `~/.kerghan/kerghan.env` (mode 600) with the instance secrets, in
  `ensure_env_file` in `standalone/bin/kerghan`.
- The inner compose file (`standalone/vault/docker-compose.yml`) passes only an explicit list of
  variables to the app container.
- `~/.kerghan/config` holds client settings only.
- The client publishes the port with `-p "$port:80"`, which means all interfaces.

## Pass-through

Add every `KERGHAN_DEFAULT_USER_*` variable ([configuration.md](configuration.md#variables)) to the
app container's pass-through list in `standalone/vault/docker-compose.yml`.

## New installations

When `ensure_env_file` creates `kerghan.env`, it also writes:

```bash
KERGHAN_DEFAULT_USER_ENABLED=true
KERGHAN_DEFAULT_USER_USERNAME=admin
KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local
KERGHAN_DEFAULT_USER_PASSWORD=<generated>
KERGHAN_DEFAULT_USER_ADMIN=true
```

`<generated>` is 32+ random characters from `openssl rand`
([security.md](security.md#credentials)). The default user therefore always exists in the
standalone version, and its password is known, so the user can log in manually when automatic
login is off.

## `auto-login`

- A new `~/.kerghan/config` setting, `auto-login=true|false`, **default `true`**, documented in
  `standalone/config.example`.
- New `kerghan up` flags, `--auto-login` / `--no-auto-login`.
- Precedence follows the existing rule: command-line flag, then config file, then default.
- The client translates the resolved value into `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` for
  the container.
- A changed value recreates the instance on the next `kerghan up`, keeping the data volume, like
  the other settings that recreate it.

Out of the box, a standalone installation therefore opens already logged in as an admin.

## `bind`

- A new `~/.kerghan/config` setting, `bind=<address>`, and a `kerghan up --bind ADDRESS` flag,
  documented in `standalone/config.example`. Same precedence: flag, then config, then default.
- It controls which host interface the port is published on.
- Default: `127.0.0.1` when automatic login is on; `0.0.0.0` (current behavior) when it is off.

## Allowlist value

The client sets `KERGHAN_DEFAULT_USER_ALLOWED_IPS` to whatever a request from the host actually
looks like to the backend.

### Open risk: effective client IP

**Open, owned by #371.** Inside Docker-in-Docker, a request from the host travels through Vault,
then the Tent proxy, then the backend. It probably arrives from a Docker gateway address rather
than `127.0.0.1`. #371 confirms the effective client IP and how the proxy forwards it, sets
`KERGHAN_DEFAULT_USER_ALLOWED_IPS` (and proxy trust, such as `KERGHAN_TRUSTED_PROXY_HOPS`, if
needed) accordingly, then updates this section with the result.

## Existing installations

Implemented by #372.

- A `kerghan.env` created by an older version is **not** modified automatically on upgrade.
- A new client command (its name is decided in #372) updates an existing `kerghan.env`:
  - adds only the missing variables, starting with the `KERGHAN_DEFAULT_USER_*` ones, with a
    generated password;
  - keeps existing values untouched and keeps mode 600;
  - reports which variables it added;
  - is idempotent;
  - tells the user to restart the instance to apply the change.

## Required tests (bats)

- A new `kerghan.env` contains the default-user values above, with a generated password of 32+
  characters, and mode 600.
- `auto-login` resolution: flag over config over default (`true`), translated into
  `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`; a changed value recreates the instance and keeps the
  data volume.
- `bind` resolution: flag over config over default; default `127.0.0.1` with automatic login on and
  `0.0.0.0` with it off.
- A fresh installation is logged in from the host and is not reachable from other interfaces by
  default.
- Update command: missing `kerghan.env`, already up to date, partially missing keys, existing
  values and mode preserved, idempotent on a second run.
