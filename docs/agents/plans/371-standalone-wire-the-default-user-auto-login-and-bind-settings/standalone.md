# Standalone Plan: Standalone: wire the default user, auto-login and bind settings

Main plan: [plan.md](plan.md)

## Overview
Make a fresh standalone installation open already logged in as `admin` from the host browser, while publishing the port only on `127.0.0.1` by default. Every change is in `standalone/` plus the default-user spec file.

## Context
- Spec: `docs/agents/specs/default-user/standalone.md` (and `security.md`, `configuration.md`). The backend side (#368, #369, #370) is merged: `DefaultUserConfig` reads every `KERGHAN_DEFAULT_USER_*` variable, and `status.json` performs the automatic login for allowed IPs.
- The client is `standalone/bin/kerghan` (bash 3.2 compatible, see its header). Settings go through `load_config` into `CFG_*` globals. `cmd_up` resolves flag, then config, then default before any side effect. `recreate_reason` decides whether a running instance must be recreated. `up_instance` builds the `vault up` arguments (`--env-file`, `-p "$port:80"`, extra `-e` from `frontend_base_url_args`).
- Decisions from the issue dialogue:
  - The client always passes `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` and `KERGHAN_DEFAULT_USER_ALLOWED_IPS` with `-e`, overriding `kerghan.env` (unlike `FRONTEND_BASE_URL`).
  - The allowlist is loopback plus the private ranges: `127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`. The real exposure guard is `bind=127.0.0.1`.
  - Auto-login on with a non-loopback bind prints a warning but does not refuse to start.
- Existing `kerghan.env` files are not modified (that is #372).

## Steps

- [01 — Compose pass-through and new kerghan.env values](standalone/01-compose-and-env-file.md)
- [02 — auto-login and bind settings, flags and vault args](standalone/02-auto-login-and-bind.md)
- [03 — Recreate on a changed auto-login or bind](standalone/03-recreate-on-change.md)
- [04 — Docs: config.example and help text](standalone/04-docs.md)
- [05 — Confirm the effective client IP and update the spec](standalone/05-client-ip-and-spec.md)

## CI Checks
- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: the bats/bats `bats standalone/test` job)

## Notes
- Keep the client bash 3.2 compatible (no associative arrays, `${var,,}`, `mapfile` and so on).
- Never run `bats` on the host. Use the `standalone_tests` docker-compose service.
- Step 05 needs a real Docker host (a built `kerghan-standalone` image), so it cannot run in CI. If the implementer cannot run it, they keep the private-range allowlist, say so in the PR, and record in the spec that the check is still pending.
- With docker-proxy port publishing, LAN clients may arrive with the same gateway IP as the host, so the backend allowlist cannot tell them apart. This is why `bind` is the real guard, and why the unsafe-combination warning matters.
