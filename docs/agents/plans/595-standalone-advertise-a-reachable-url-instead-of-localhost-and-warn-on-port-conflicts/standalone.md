# Standalone Plan: Standalone: warn on port conflicts on kerghan up and document the macOS AirPlay port clash

Main plan: [plan.md](plan.md)

## Overview

All the work lives in the `kerghan` client (`standalone/bin/kerghan`), its bats suite (`standalone/test/`) and the standalone docs. There are three parts: a listener-detection helper, the conflict warning wired into `cmd_up`, and the docs.

## Context

- The client publishes the port on an IPv4 `bind` only (`-p <bind>:<port>:80` in `up_instance`). On macOS the AirPlay Receiver (ControlCenter) listens on `*:5000` and `*:7000` on both IPv4 and IPv6, and Docker's `127.0.0.1:5000` bind still succeeds. `localhost` resolves to `::1` first, so the browser reaches AirPlay (`403`, `Server: AirTunes`), and nothing warns the user.
- `cmd_up` either returns early on the "already running" path, or (after `vault down` on a recreate) calls `up_instance`. The check goes right before that `up_instance` call. At that point Kerghan does not hold the port, so **any listener found belongs to another process**, and there's no need to recognise Docker's own listener.
- An existing hint already covers Docker's own bind failure (`port is already allocated`, in `up_instance`). It stays as it is.
- The client must keep working on bash 3.2 (CI job `standalone_tests_bash32`).

## Steps

- [01 — Add the port_listeners helper](standalone/01-port-listeners-helper.md)
- [02 — Warn on a port conflict in kerghan up](standalone/02-conflict-warning.md)
- [03 — Document the check and the macOS AirPlay clash](standalone/03-docs.md)

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`)
- `standalone/` on bash 3.2: `docker-compose run --rm standalone_tests_bash32` (CI job: `standalone_tests_bash32`)

## Notes

- **Shared contract with #597:** `port_listeners <port>` is reused as is by `kerghan diagnose`. Keep its output format and its "skipped" status stable, and documented in a comment above the function.
- Use `lsof +c 0`, because the default truncates command names to 9 characters (`ControlCe`), which would break the AirPlay match.
- The test harness must never run the host's real `lsof`/`ss`. Developers on macOS have `lsof`, so without a default stub the tests would become host-dependent.
- Out of scope: the advertised URL, `FRONTEND_BASE_URL`, the published addresses (#598), the logs (#596), and `kerghan diagnose` itself (#597).
