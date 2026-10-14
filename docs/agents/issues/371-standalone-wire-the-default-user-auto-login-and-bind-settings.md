# Issue: Standalone: wire the default user, auto-login and bind settings

## Description

Part of #366. Wire the default user into the standalone distribution, building against `docs/agents/specs/default-user/standalone.md`. The backend side (#368, #369, #370) is done; this issue covers the client (`standalone/bin/kerghan`), the inner compose file, `standalone/config.example`, bats tests and the spec update.

Existing `kerghan.env` files are **not** modified here; that is #372.

## Problem

The backend now supports a default user and automatic login, but the standalone distribution passes none of the `KERGHAN_DEFAULT_USER_*` variables to the app container, never generates them, and publishes the port on all interfaces (`-p "$port:80"`). A fresh installation therefore still asks for a login, and turning on automatic login without restricting the published interface would hand admin access to anyone who can reach the port.

## Expected Behavior

- A fresh standalone installation opens already logged in as `admin` from the host browser.
- By default the port is published on `127.0.0.1` only, so it is not reachable from other interfaces.
- `auto-login` and `bind` follow the client precedence rule (flag, then `~/.kerghan/config`, then default), and changing either recreates the instance on the next `kerghan up`, keeping the data volume.
- When `auto-login` is on and `bind` resolves to a non-loopback address (e.g. an explicit `bind=0.0.0.0`), `kerghan up` still starts, but prints a warning that anyone who can reach the port is logged in as admin.

## Solution

- **Pass-through:** add every `KERGHAN_DEFAULT_USER_*` variable to the `kerghan` service pass-through list in `standalone/vault/docker-compose.yml` (name only, like the other optional variables).
- **New installations:** when `ensure_env_file` creates `~/.kerghan/kerghan.env` (mode 600), also write:
  - `KERGHAN_DEFAULT_USER_ENABLED=true`
  - `KERGHAN_DEFAULT_USER_USERNAME=admin`
  - `KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local`
  - `KERGHAN_DEFAULT_USER_PASSWORD=<32+ random characters from openssl rand>` (it must pass the backend registration password rules)
  - `KERGHAN_DEFAULT_USER_ADMIN=true`
- **`auto-login`:** new `~/.kerghan/config` key `auto-login=true|false` (default `true`) and `kerghan up --auto-login` / `--no-auto-login`. The resolved value becomes `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`. Invalid values fail like the other config keys, with the line number.
- **`bind`:** new `~/.kerghan/config` key `bind=<address>` and `kerghan up --bind ADDRESS`. The port is published as `-p "$bind:$port:80"`. Default: `127.0.0.1` when auto-login is on, `0.0.0.0` when it is off.
- **Client-managed variables win:** the client passes `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` and `KERGHAN_DEFAULT_USER_ALLOWED_IPS` with `-e` on `vault up`, overriding any value in `kerghan.env`. `auto-login` and `bind` stay the single source of truth (unlike `FRONTEND_BASE_URL`, which the client only injects when `kerghan.env` lacks it).
- **Recreation:** extend the running-instance comparison (`recreate_reason`) so a changed `auto-login` (read from the running container environment) or a changed `bind` (read from the published host IP) recreates the instance with a clear reason, keeping the data volume, like a port change.
- **Allowlist value:** Tent overwrites `X-Forwarded-For` with its own `REMOTE_ADDR`, and a host request goes through Docker port publishing twice (host, Vault, inner Docker, Tent), so the backend sees a Docker gateway address that varies between hosts (Linux, Docker Desktop), and LAN clients may look the same. The client therefore sets `KERGHAN_DEFAULT_USER_ALLOWED_IPS` to loopback plus the private ranges (`127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`), and the real exposure guard is `bind=127.0.0.1`. The implementer still confirms end to end which IP actually reaches the backend (and whether `KERGHAN_TRUSTED_PROXY_HOPS` needs setting), narrows the list if that IP is stable across hosts, and records the finding in the "Open risk: effective client IP" section of `docs/agents/specs/default-user/standalone.md`.
- **Unsafe combination warning:** auto-login on with a non-loopback `bind` prints a warning, but does not refuse to start.
- **Docs:** document `auto-login` and `bind` (defaults, precedence, recreation, the warning) in `standalone/config.example` and the `kerghan up` help text.

### Acceptance criteria

- Bats tests cover:
  - a new `kerghan.env` contains the default-user values, a generated password of 32+ characters, and mode 600;
  - `auto-login` resolution (flag over config over default `true`) and its translation into `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`, overriding `kerghan.env`;
  - `bind` resolution (flag over config over default), with default `127.0.0.1` when auto-login is on and `0.0.0.0` when it is off;
  - `KERGHAN_DEFAULT_USER_ALLOWED_IPS` is passed and overrides `kerghan.env`;
  - a changed `auto-login` or `bind` recreates the instance and keeps the data volume;
  - the warning on auto-login with a non-loopback bind.
- Manual end-to-end check: a fresh installation opens logged in as `admin` from the host browser, and the port is not reachable from other interfaces by default.
- The spec effective-client-IP section is updated with the finding.

## Benefits

- Standalone works out of the box as a single-user tool, with no login step.
- Safe by default: automatic admin login is only reachable from the host loopback interface.
- Users can still opt out (`--no-auto-login`) and log in manually with the generated credentials, or expose the instance deliberately with `bind`.
