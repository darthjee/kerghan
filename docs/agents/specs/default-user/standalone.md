# Standalone

Implemented by #371 (wiring, `auto-login`, `bind`) and #372 (update command). Part of the
[default-user specs](README.md).

## Before #371

- The client generated `~/.kerghan/kerghan.env` (mode 600) with the instance secrets only, in
  `ensure_env_file` in `standalone/bin/kerghan`.
- The inner compose file (`standalone/vault/docker-compose.yml`) passes only an explicit list of
  variables to the app container, and listed none of the `KERGHAN_DEFAULT_USER_*` ones.
- `~/.kerghan/config` held client settings only.
- The client published the port with `-p "$port:80"`, which means all interfaces.

## Pass-through

Every `KERGHAN_DEFAULT_USER_*` variable ([configuration.md](configuration.md#variables)) is on the
app container's pass-through list in `standalone/vault/docker-compose.yml` (name only, like the
other optional variables). `KERGHAN_TRUSTED_PROXY_HOPS` is not passed: its default (`1`) is right
for standalone (see [Effective client IP](#effective-client-ip)).

## New installations

When `ensure_env_file` creates `kerghan.env`, it also writes:

```bash
KERGHAN_DEFAULT_USER_ENABLED=true
KERGHAN_DEFAULT_USER_USERNAME=admin
KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local
KERGHAN_DEFAULT_USER_PASSWORD=<generated>
KERGHAN_DEFAULT_USER_ADMIN=true
```

`<generated>` is `openssl rand -hex 24`: 48 random hex characters
([security.md](security.md#credentials)), with no `+/=`, so it is easy to type and safe in an env
file. The default user therefore always exists in the standalone version, and its password is
known, so the user can log in manually when automatic login is off.

`KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` and `KERGHAN_DEFAULT_USER_ALLOWED_IPS` are not written
to `kerghan.env`: the client passes them on every `up` (see
[Client-managed variables](#client-managed-variables)).

## `auto-login`

- A `~/.kerghan/config` setting, `auto-login=true|false`, **default `true`**, documented in
  `standalone/config.example`. Any other value fails with the file name and line number, like the
  other keys.
- `kerghan up` flags, `--auto-login` / `--no-auto-login` (the last one wins).
- Precedence follows the existing rule: command-line flag, then config file, then default.
- The client translates the resolved value into `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` for
  the container.
- A changed value recreates the instance on the next `kerghan up`, keeping the data volume, like
  the other settings that recreate it. The running value is read from the container environment;
  a missing one (an instance started by an older client) counts as `false`.
- **`kerghan.env` without the default user.** The backend refuses to boot when
  `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true` and the username, email or password is missing
  (`DefaultUserConfig`). A `kerghan.env` created before #371 has none of them, and the client never
  rewrites it. So when `kerghan.env` lacks a non-blank `KERGHAN_DEFAULT_USER_USERNAME`,
  `KERGHAN_DEFAULT_USER_EMAIL` or `KERGHAN_DEFAULT_USER_PASSWORD`:
  - `auto-login` not set (no flag, no config value): it resolves to `false`, so `bind` defaults to
    `0.0.0.0` and the instance behaves as before #371; `up` prints a notice that automatic login
    needs the `KERGHAN_DEFAULT_USER_*` values in `kerghan.env` (see
    [Existing installations](#existing-installations));
  - `auto-login=true` set by flag or config: `up` fails with an error and a hint, and starts
    nothing, rather than starting a backend that cannot boot.

  Upgrading the client therefore leaves an existing installation with automatic login off (and,
  since the running instance has no value, which counts as `false`, does not recreate it for
  this).

Out of the box, a new standalone installation therefore opens already logged in as an admin.

## `bind`

- A `~/.kerghan/config` setting, `bind=<address>`, and a `kerghan up --bind ADDRESS` flag,
  documented in `standalone/config.example`. Same precedence: flag, then config, then default.
- It controls which host interface the port is published on: `-p "$bind:$port:80"`.
- Only IPv4 addresses are accepted (four `0-255` octets). Docker needs IPv6 host addresses in
  brackets, and IPv6 is not supported here.
- Default: `127.0.0.1` when automatic login is on; `0.0.0.0` (the previous behavior) when it is
  off.
- A changed value recreates the instance on the next `kerghan up`, keeping the data volume. The
  running value is the published host IP; an empty one (Docker's "every interface") counts as
  `0.0.0.0`.
- The user-facing URL stays `http://localhost:<port>`, which works from the host with any bind.

### Unsafe combination warning

When automatic login is on and `bind` is not a loopback address (outside `127.0.0.0/8`, for
example `bind=0.0.0.0`), `kerghan up` prints a warning that anyone who can reach the port is
logged in as admin, plus a hint to use `--no-auto-login` or `bind=127.0.0.1`. It still starts:
this is a deliberate choice by the user.

## Client-managed variables

The client always passes `-e KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=<auto-login>` and
`-e KERGHAN_DEFAULT_USER_ALLOWED_IPS=<allowlist>` on `vault up`, after `--env-file`. Docker gives
`-e` precedence over `--env-file`, so these override any value in `kerghan.env`: `auto-login` and
`bind` stay the single source of truth. This differs from `FRONTEND_BASE_URL`, which the client
only injects when `kerghan.env` lacks it.

## Allowlist value

```
KERGHAN_DEFAULT_USER_ALLOWED_IPS=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

Loopback plus the private ranges (`DEFAULT_USER_ALLOWED_IPS` in `standalone/bin/kerghan`). The
allowlist is not the exposure guard: **`bind=127.0.0.1` is**. With the default bind, only
processes on the host can reach the port at all.

### Effective client IP

**Partly confirmed by #371** (Docker Desktop for macOS, arm64, only; see the open items below).

Path of a host request: host, port published by the outer Docker daemon, the Vault container, port
published by the inner Docker daemon, Tent, backend. Tent's `SetClientIpMiddleware` overwrites
`X-Forwarded-For` with its own `REMOTE_ADDR` (a single entry), and the backend reads the rightmost
hop with `KERGHAN_TRUSTED_PROXY_HOPS` at its default of `1`, so the backend sees exactly the
address Tent's socket sees. No hop override is needed.

Measured (2026-10-14, Docker Desktop on macOS, arm64) with `darthjee/vault:0.1.0` running a probe
inner service published like Tent (`ports: ["80:80"]`, the same inner path Tent receives):

| Outer publish | Request from | Address seen by the inner service |
|---|---|---|
| `127.0.0.1:<port>:80` (default bind) | host, `127.0.0.1` | `172.17.0.1`, the outer daemon's bridge gateway |
| `0.0.0.0:<port>:80` | host, `127.0.0.1` or its LAN address | `172.64.155.209`, a non-private address |

- The inner daemon forwards with iptables DNAT, so it preserves the source address that the outer
  daemon hands to the Vault container (the Vault container was `172.17.0.3`, gateway
  `172.17.0.1`). The effective IP therefore depends on the outer host's Docker networking, not on
  the image.
- With the default bind, the effective IP is inside `172.16.0.0/12`, so a fresh installation logs
  in automatically from the host.
- With `bind=0.0.0.0` on this host, every request (even from the host itself) arrived from
  `172.64.155.209`, outside the allowlist, so automatic login would not happen there. The cause
  was not confirmed (Docker Desktop's port forwarder for all-interface binds, or something
  installed on that machine).
- With `127.0.0.1` published, the host's LAN address could not reach the port (connection
  refused), so the default bind is not reachable from other interfaces.

The allowlist is kept at the full private-range list rather than narrowed to `172.17.0.1`:
only one host type was measured, and the outer gateway changes with the Docker setup (a Linux
daemon with a custom `bip` or `default-address-pools`, other Docker Desktop settings).

Open verification items:

- The same check on a Linux host (native Docker, with and without Sysbox).
- A full end to end check with a `kerghan-standalone` image that contains the default-user
  backend: `status.json` reports `admin` from the host browser with the default settings. Only the
  network path above was measured, not the backend itself.
- On a Linux host with `bind=0.0.0.0`, LAN clients reach the inner service through DNAT with
  their real (often private) address, which is inside the allowlist. This is why the warning above
  exists and why `bind` is the real guard.

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
  characters, and mode 600; it does not contain the client-managed variables.
- `auto-login` resolution: flag over config over default (`true`), translated into
  `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`; invalid config values fail with the line number.
- A `kerghan.env` without the default user: the default `auto-login` resolves to `false` (bind
  `0.0.0.0`) with a notice; an explicit `auto-login=true` (flag or config) fails without starting.
- `bind` resolution: flag over config over default; default `127.0.0.1` with automatic login on and
  `0.0.0.0` with it off; invalid values fail (config with the line number, flag with a usage error).
- `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` and `KERGHAN_DEFAULT_USER_ALLOWED_IPS` are always
  passed with `-e` after `--env-file`, even when `kerghan.env` sets them.
- A changed `auto-login`, a changed `bind`, and an instance started without the variable each
  recreate the instance and keep the data volume; unchanged settings are a no-op.
- The warning appears for automatic login with a non-loopback bind, and not otherwise; `up` still
  starts.
- Manual (not bats): a fresh installation is logged in from the host and is not reachable from
  other interfaces by default.
- Update command: missing `kerghan.env`, already up to date, partially missing keys, existing
  values and mode preserved, idempotent on a second run.
