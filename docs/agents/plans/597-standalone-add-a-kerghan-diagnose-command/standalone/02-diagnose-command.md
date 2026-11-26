# The diagnose command

Add `cmd_diagnose`. It takes no arguments (any argument → `usage_error`, exit 2), calls
`load_config` (read-only), and prints the report to stdout in the layout from the issue's
`### Output` section: a header line `kerghan diagnose (client <KERGHAN_VERSION>)`, then the
sections below, each line prefixed `[ok]`, `[FAIL]`, `[warn]`, `[skip]` or `[info]`, then
`Verdict: ...` and, when one applies, a `hint: ...` line. ASCII only, no color.

Keep a single "first failure" state: the first failing check sets the verdict text and the exit
code (table in the issue's `### Verdict and exit codes`), and later checks still print their lines
but never override it.

Checks, in order:

1. **Engine** (E2): `with_timeout 5 docker info`. On failure: verdict
   `cannot reach the Docker engine`, exit 3, and stop (the other sections are left out).
2. **Instance** (E1): `running_image`, `docker inspect` for the state and exit code. Absent or
   stopped container: verdict `Kerghan is not running; start it with 'kerghan up'` (a stopped one
   shows its exit code), exit 1, and stop. Otherwise print the image, then
   `published on <bind>:<port>, auto-login <on|off>` from `running_bind`, `running_port` and
   `running_auto_login`. E7: when the config's effective port, bind or image differs from the
   running one, print `[info] config wants ...; applies on the next 'kerghan up'`. Never print
   `.Config.Env` or `kerghan.env` values.
3. **Services** (E8): `with_timeout 10 vault_cmd compose ps` (choose the format that is the
   least fragile, e.g. `--format` with name, state and health when Vault supports it). Parse only
   the service name and state/health for `tent`, `kerghan` and `mysql`. A row that cannot be
   parsed → `[info] <service> unknown`, not a failure. A service that exited or is unhealthy →
   `[FAIL]`, verdict `<service> is <state>; see 'kerghan logs'` (plus the log dir when file logs
   are on), exit 4.
4. **Probes**: skipped with a `[skip]` line for a remote `DOCKER_HOST` (E3, reason
   `remote Docker engine (<docker_host_label>)`) or when `curl` is missing (E10).
   - Probe 1: `http://<published_probe_host>:<port>/health.json`. Kerghan is identified by status
     `200` and a body that is exactly `{"status":"ok"}` (whitespace-trimmed). Only then probe
     `/ready.json`: `200` → ready; `503` → `[FAIL]` not ready (database), exit 4; `404` →
     `[info] readiness unknown`. Any other response → `[FAIL] <code> from another service
     (Server: <sanitized>)`, exit 5. `timeout` or `refused` → `[FAIL]` does not answer, exit 5.
   - Probe 2: `advertised_url <bind> <port>` + `/health.json`, only when its host:port differs from
     probe 1's. A non-Kerghan response or no answer while probe 1 identified Kerghan →
     `[FAIL]`, verdict `<host:port> is answered by another process (<who>)` or
     `<host:port> does not answer`, followed by `Kerghan is reachable at <published URL>`, exit 6.
     `<who>` is `AirPlay Receiver` when the listener check finds `ControlCenter` on port 5000 or
     7000, otherwise the sanitized `Server` value.
   - E6: when `FRONTEND_BASE_URL` is set in `kerghan.env`, print it as `[info]`. It is not a
     secret, and it is never probed.
   - A foreign response body is never printed.
5. **Listeners on port <port>** (E9, E11): skipped for a remote engine (E3) or when
   `port_listeners` returns 2. For each line: an `is_docker_process` name → `[info]`, an empty name
   → `[info] ... unknown process`, any other name → `[warn]`. No listener → `[info] no listener
   visible`. Listeners never change the verdict or the exit code.
6. **Logs**: when `running_file_logs` is `true`, `[info] <display_path of running_log_dir>`.
   Otherwise no section.
7. **Verdict**: `OK` (exit 0), or `OK (partial: probes skipped)` (exit 0) when the probes were
   skipped, or the first failure. Add the AirPlay hint line (the same text as
   `warn_port_conflict`'s hint, reuse a shared constant or function) when the verdict is the
   AirPlay case.

The command never writes anything except temp files from `mktemp`, which a trap removes.

## Files to Change

- `standalone/bin/kerghan`: `cmd_diagnose` and any private helpers it needs (section printing,
  failure state, `compose ps` parsing).
