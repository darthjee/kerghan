# Standalone: `kerghan diagnose`

Part of [Standalone Distribution](../standalone.md). `kerghan diagnose` checks a standalone
instance end to end from the host and prints a short, paste-friendly report ending in one verdict.
It is read-only and runs client-side (bash 3.2-safe): the failure it was built for, another service
answering the port, never reaches the server. The code is `cmd_diagnose` in `standalone/bin/kerghan`;
the tests are `standalone/test/diagnose.bats`. Added in #597, as part of #594.

## What it checks

In this order; the first failure sets the verdict and the exit code, and later checks still print
their lines:

1. **Engine:** `docker info` (wrapped in `timeout` when it is on `PATH`). Failure: exit 3, and
   nothing else runs.
2. **Instance:** `vault-kerghan` is running, with which image, bind and port (read from the
   container through `running_image`, `running_bind`, `running_port`, not from the config) and
   auto-login. Absent or stopped (a stopped one shows its exit code): exit 1, and nothing else
   runs. When the config's port, bind or image differs from what runs, an `[info]` note says it
   applies on the next `kerghan up`.
3. **Services:** `vault compose ps` for `tent`, `kerghan` and `mysql`. Only the service name and
   state/health are parsed; an unparsable or missing row is `unknown`, not a failure. A service
   that exited or is unhealthy fails with exit 4 and points to `kerghan logs` (and the log
   directory when file logs are on).
4. **Probes** (see below).
5. **Listeners on the port:** `port_listeners` (#595). Docker's own names (`com.docker.*`,
   `docker-proxy`, `vpnkit`, `OrbStack`, `rootlesskit`, `gvproxy`, `limactl`) are `[info]`, an empty
   name is `unknown process`, any other name is `[warn]`. Listeners are supporting evidence only:
   they never change the verdict or the exit code.
6. **Logs:** the log directory (`running_log_dir`), when file logs are on.

## Probes

Both read the running container, and use `curl -q --connect-timeout 2 --max-time 3 --noproxy '*'
--proto '=http,https'`, with no `-L`, cookies or auth.

1. **Published address:** `<bind>:<port>`, or `127.0.0.1:<port>` for `0.0.0.0`.
2. **Advertised URL:** the one `kerghan up` prints, through `advertised_url` (shared with `up`, so
   the two never drift; see [Advertised URL](client.md#advertised-url)). It is probed only when its
   host:port differs from probe 1; when they are equal (every `bind` since #598) there is no second
   request, and once probe 1 finds Kerghan the report says
   `[ok] advertised URL is the published address`. The second probe and exit 6 remain for the case
   where the two ever differ.

### Identification

Kerghan is identified by the marker `"app":"kerghan"` in the body of `GET /health.json`, whatever
the status code (#609). The body is matched with whitespace stripped, with no JSON parser (no `jq`
dependency), so key order does not matter. Images released before the marker are still accepted: a
`200` whose whole body is `{"status":"ok"}`. Everything else, including a different `app`, is
another service. The `Server` header is printed, never used to decide.

| `/health.json` answer | Report line | Effect |
|---|---|---|
| marker with `2xx` | `[ok] ... Kerghan <version> (Server: ...)` | `/ready.json` is probed |
| marker with `5xx` | `[FAIL] ... Kerghan proxy answered <code>, backend down (Server: ...)` | exit 4, `/ready.json` is not probed |
| marker with any other code | `[ok] ... Kerghan <version> answered <code> (Server: ...)` | `/ready.json` is probed |
| legacy `200 {"status":"ok"}` | `[ok] ... Kerghan (Server: ...)` | `/ready.json` is probed |
| anything else | `[FAIL] ... <code> from another service (Server: ...)` | exit 5 |

`<version>` is the `version` field of the body, shown only when it has the form `<n>.<n>.<n>`;
otherwise (absent, as it may be, or anything else) nothing is shown.

The `5xx` case becomes reachable once #613 ships the Tent fallback for a backend that does not
answer. Until then a down backend still shows up as an empty `200`, which is reported as another
service (exit 5, unless a failed service already set exit 4).

### Readiness

`/ready.json` is probed only once the published address is identified as Kerghan:

| `/ready.json` answer | Report line | Effect |
|---|---|---|
| `200` with `"status":"degraded"` | `[warn] ... degraded (workers)` | not a failure: the workers are down, the instance still serves |
| any other `200` | `[ok] ... ready` | none |
| `503` | `[FAIL] ... not ready (database)` | exit 4 |
| anything else (such as `404` on an old image) | `[info] ... readiness unknown (<status>)` | not a failure |

### Verdicts

| Published | Advertised | Verdict | Exit |
|---|---|---|---|
| Kerghan | Kerghan, or same address | `OK` | 0 |
| Kerghan, backend down | not probed | `Kerghan answers but the backend is down` + where the logs are | 4 |
| Kerghan | Kerghan, backend down | `Kerghan answers but the backend is down` + where the logs are | 4 |
| Kerghan | another service | `<host:port> is answered by another process (<who>)` + `Kerghan is reachable at <published URL>` (`AirPlay Receiver` plus its hint when it applies) | 6 |
| Kerghan | timeout / refused | `<host:port> does not answer` + `Kerghan is reachable at <published URL>` | 6 |
| another service / timeout | not probed | `<host:port> is answered by another process (...)` / `does not answer` | 5 |

## Output and exit codes

ASCII markers only (`[ok]`, `[FAIL]`, `[warn]`, `[skip]`, `[info]`), no color. The verdict comes
last, followed by a `hint:` line when one applies.

| Exit | Meaning |
|---|---|
| 0 | Healthy (`OK`, or `OK (partial: probes skipped)`) |
| 1 | Not running |
| 2 | Usage error (any argument) |
| 3 | Docker engine unreachable |
| 4 | Unhealthy: an inner service is down or unhealthy, `/ready.json` is `503`, or the backend is down behind the proxy (a `5xx` `/health.json` with the Kerghan marker) |
| 5 | Published address broken |
| 6 | Advertised URL broken while the published address works (only when the two differ, which no `bind` produces since #598) |

Skipped checks never fail the run: a remote `DOCKER_HOST` (`tcp://`, `ssh://`; only scheme and
host are shown) skips the probes and listeners, a missing `curl` skips the probes, a missing
`lsof`/`ss` skips the listeners. When `FRONTEND_BASE_URL` is set in `kerghan.env` (HTTPS through
a proxy) it is printed and never probed.

## Security

- Read-only: it never calls `ensure_env_file` or anything else that writes under `~/.kerghan`.
- No secrets: `kerghan.env` values and the container's `.Config.Env` are never printed.
- Untrusted responses: only the status code, the `Server` header (control characters stripped and
  cut to 100 characters) and a Kerghan `version` that matches `<n>.<n>.<n>` are printed; a body is
  never printed, foreign or not.
- The log directory is shown as `~/...` when under `$HOME`.
