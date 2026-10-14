# Add the client-IP verification script
Add `standalone/scripts/verify_client_ip.sh`, in the same style as `smoke_test.sh` (header comment that documents the env inputs, `set -euo pipefail`, `log`/`fail` helpers, a cleanup trap that always removes its containers and volumes). It prints a single, copy-pasteable report block that the user pastes back into the issue or PR.

Modes:
- **`probe`** (default): repeats the #371 measurement. Starts `darthjee/vault:<pinned>` (Sysbox when `--runtime=sysbox-runc` is available and selected, otherwise `--privileged`; selectable with `RUNTIME=sysbox|privileged`) with an inner compose service that echoes the request's source address (e.g. `traefik/whoami`, pinned), published like Tent (`ports: ["80:80"]`). The outer container is published on `BIND:PORT:80` (`BIND` defaults to `127.0.0.1`). The script curls it from the host and reports the source address seen. It also prints `PROBE_URL` so a LAN machine can hit the same endpoint while it waits (`HOLD=true` keeps it up until Ctrl-C).
- **`reach`**: with the probe running on `BIND=127.0.0.1`, tries each of the host's non-loopback addresses (from `ip -o addr` on Linux, `ifconfig` on macOS) and reports whether the port is reachable. It also prints the one-liner a second LAN machine should run against the host's LAN IP for the moby#45610 check.
- **`e2e`**: no container management. Given `BASE_URL` (default `http://localhost:<port>` from `~/.kerghan/config` or `3000`), POSTs `/auth/status.json` without cookies and reports `loggedIn`, the user, `isAdmin`, and the `kerghan-standalone` image tag of the running instance (from `docker inspect`).

Every report includes the platform (`uname -sm`), Docker Engine version (`docker version --format '{{.Server.Version}}'`), Docker Desktop vs. native (from `docker info`), runtime, bind, and the date, so each result can go straight into the docs table.

## Files to Change
- `standalone/scripts/verify_client_ip.sh` — new script (probe / reach / e2e modes).
- `standalone/scripts/verify_client_ip/compose.yml` (or inline heredoc) — inner probe compose file, if it is not generated inline.
