# Issue: Standalone: add a kerghan diagnose command

## Description

Part of #594, which is released only once all its sub-issues are done. Builds on #595 (merged:
reuses its `port_listeners` helper and AirPlay hint) and #596 (merged: reads the running
instance's log directory via `running_log_dir`). Related: #598 (the advertised URL, still open;
diagnose follows whatever it decides) and #609 (a future identity marker on `/health.json`).

## Problem

When a standalone instance looks broken, nothing in the `kerghan` client checks it end to end. In
the case behind #594, `curl localhost:5000` returned `403` from macOS's AirPlay Receiver
(`Server: AirTunes`), not from Kerghan, because Docker published the port on `127.0.0.1` only and
`localhost` resolved to `::1`. Finding that took `lsof` and reading the `Server` header by hand.

## Expected Behavior

- `kerghan diagnose` checks a standalone instance end to end from the host and prints a short,
  paste-friendly report ending in one verdict.
- It tells "Kerghan answers" apart from "another process answers the port" (the #594 AirPlay
  case) and from "nothing answers", and names the URL that does reach Kerghan.
- It exits with a distinct code per failure class, so scripts can use it.
- It never changes anything and never prints secrets.

## Solution

A new read-only `kerghan diagnose` command, run client-side (bash). It has to be client-side: the
failure case (another service on the port) never reaches the server.

It checks and reports:

1. Whether the instance (`vault-kerghan`) is running, and with which image and port.
2. The inner services' state (`compose ps` for `tent`, `kerghan`, `mysql`).
3. Probes of `/health.json` (and `/ready.json`) on the published address and on the advertised
   URL. See [Probes](#probes) and [Identifying Kerghan](#identifying-kerghan).
4. The listeners on the port (reusing #595's `port_listeners` helper), flagging any process
   other than Docker. See [Edge cases](#edge-cases) (E9).
5. Where the log files are, when file logs are on (#596's `running_log_dir`).
6. A short verdict at the end, and an exit code. See [Output](#output) and
   [Verdict and exit codes](#verdict-and-exit-codes).

Add it to the help text and bash completion.

### Probes

Two probes, read from the running container (`running_bind` / `running_port`), not from the
config:

1. **Published address**: `<bind>:<port>`, or `127.0.0.1:<port>` when the bind is `0.0.0.0`. This
   answers "is Kerghan up where Docker published it?"
2. **Advertised URL**: the URL `kerghan up` prints, read through the same helper `up` uses, so the
   two never drift. It is probed only when its host differs from probe 1. Today that is
   `http://localhost:<port>`. This answers "does the URL the user types reach Kerghan?", which is
   the #594 failure.
   - It is deliberately not hard-coded to `localhost`: whatever #598 decides (advertise the bind
     address, also publish on `[::1]`, or keep `localhost`), probe 2 follows it. If the advertised
     URL becomes the bind address, probe 2 disappears on its own.
   - A plain `curl` on the advertised URL behaves like a browser (it tries `::1` first, then IPv4),
     so `::1` is not probed separately.

| Published | Advertised | Verdict | Exit |
|---|---|---|---|
| Kerghan | Kerghan, or same address | OK | 0 |
| Kerghan | another service | `<advertised host:port> is answered by <Server>` (+ the AirPlay hint when it applies); Kerghan is reachable at `<published URL>` | non-zero |
| Kerghan | timeout / refused | `<advertised host:port> does not answer`; Kerghan is reachable at `<published URL>` | non-zero |
| another service / timeout | — | the published address itself is broken (see [Identifying Kerghan](#identifying-kerghan)) | non-zero |

#594 is released only once all its sub-issues (#595–#598, this one) are done, so the "reachable at"
hint simply names the URL that results from #598. No interim wording is needed.

### Identifying Kerghan

Client-side only, with no server change:

- **Identity / liveness:** `GET /health.json` answering `200` with the body `{"status":"ok"}` (the
  existing contract, also relied on by `standalone/scripts/smoke_test.sh`) means Kerghan answered.
  The `Server` header is not used to decide. It is printed so a human can see who answered
  (`Server: AirTunes/...` makes the macOS AirPlay case obvious).
- **Readiness:** `GET /ready.json` (`200` or `503`) reports whether Kerghan is ready, which covers
  "Kerghan answers but its database is down".
- Resulting outcomes for the probe check:
  - body matches and `/ready.json` is `200` → OK;
  - body matches but `/ready.json` is `503` → Kerghan answers but is not ready (database);
  - any other response → answered by another service (print its `Server` header);
  - no response → timeout.

Alternatives considered: matching the `Server: Apache` header alone (too generic, and fragile if
Tent stops sending it), and a server-side identity marker. The marker is tracked separately in
#609; diagnose can adopt it later but must keep working against images without it.

### Output

The report goes to stdout, in a fixed order of sections. Each line has a plain ASCII marker
(`[ok]`, `[FAIL]`, `[warn]`, `[skip]`, `[info]`): no Unicode and no color, so it pastes cleanly
into issues and is stable for tests. The verdict comes last:

```
kerghan diagnose (client 0.11.0)

Instance
  [ok]   vault-kerghan is running (darthjee/kerghan-standalone:0.11.0)
  [info] published on 127.0.0.1:5000, auto-login on
  [info] config wants port 5001; applies on the next 'kerghan up'     (E7, only when it applies)

Services
  [ok]   tent      running
  [ok]   kerghan   running
  [ok]   mysql     healthy

Probes
  [ok]   http://127.0.0.1:5000/health.json   Kerghan (Server: Apache/2.4.68 (Debian))
  [ok]   http://127.0.0.1:5000/ready.json    ready
  [FAIL] http://localhost:5000/health.json   403 from another service (Server: AirTunes/935.7.1)

Listeners on port 5000
  [info] 127.0.0.1:5000   com.docker.backend
  [warn] *:5000           ControlCenter
  [warn] [::1]:5000       ControlCenter

Logs
  [info] ~/.kerghan/logs

Verdict: localhost:5000 is answered by another process (AirPlay Receiver);
         Kerghan is reachable at http://127.0.0.1:5000
hint: on macOS turn off AirPlay Receiver in System Settings > General > AirDrop & Handoff, or pick another port
```

- A skipped section prints a single `[skip]` line with the reason, e.g.
  `[skip] remote Docker engine (DOCKER_HOST=tcp://host)`. Only the scheme and host are shown, never
  any user info from the URL.
- Sections that cannot run because an earlier check failed (E1/E2) are left out.
- The "reachable at" URL is whatever #598 settles on (#594 is released as a whole).

### Verdict and exit codes

The first failure in check order sets the verdict and the exit code:

| Exit | Meaning | Example verdict |
|---|---|---|
| 0 | Healthy (all run checks pass) | `OK` |
| 1 | Not running (E1) | `Kerghan is not running; start it with 'kerghan up'` |
| 2 | Usage error (existing `usage_error` convention) | — |
| 3 | Docker engine unreachable (E2) | `cannot reach the Docker engine` |
| 4 | Instance unhealthy: an inner service is down or unhealthy (E8), or `/ready.json` returns 503 | `mysql is unhealthy; see 'kerghan logs'` |
| 5 | Published address broken: a foreign service or a timeout on probe 1 | `127.0.0.1:5000 does not answer` |
| 6 | Advertised URL broken while the published address works (the #594 case) | the AirPlay example above |

- Skipped checks never fail the run. When the probes are skipped (remote engine, no `curl`), the
  verdict is `OK (partial: probes skipped)` and the exit code stays 0.
- `[warn]` lines (e.g. a foreign listener while the probes pass) do not change the exit code: the
  probes decide.
- The exit codes are documented in `client-diagnose.md`, and each one has a bats test.

## Edge cases

- **E1. Container absent or stopped** → "not running" (a stopped container shows its exit code),
  suggest `kerghan up`, exit 1. The remaining checks are skipped.
- **E2. Docker engine unreachable** (`docker info` fails) → its own verdict ("cannot reach the
  Docker engine"), distinct from "not running".
- **E3. Remote `DOCKER_HOST`** (`tcp://`, `ssh://`) → the container and `compose ps` checks run.
  The probe and listener checks are reported as *skipped (remote engine)*, consistent with
  `warn_port_conflict`.
- **E4. `bind=0.0.0.0`** → the published-address probe uses `127.0.0.1:<port>`.
- **E5. Specific LAN bind** (e.g. `192.168.1.10`) → probe that address directly.
- **E6. HTTPS through an external proxy** (`FRONTEND_BASE_URL` set, as in `https.md`) → probe only
  the published Kerghan port. `FRONTEND_BASE_URL` is printed as info, and the proxy is not probed.
- **E7. Config differs from the running instance** (e.g. `port=` changed but not yet applied) →
  diagnose what is running, plus a note ("config wants port X; applies on the next `kerghan up`").
- **E8. Container up, but an inner service exited or unhealthy** → its own failing verdict naming
  the service (e.g. "`mysql` is unhealthy"), pointing to `kerghan logs` or the log directory.
- **E9. Recognizing Docker's listener** → known Docker process names: `com.docker.*`,
  `docker-proxy`, `vpnkit`, `OrbStack`, `rootlesskit`, `gvproxy`, `limactl`. A listener with a
  known non-Docker name is flagged (with #595's AirPlay hint for `ControlCenter` on 5000/7000). A
  listener with an empty process name (common on Linux, where a normal user cannot see root-owned
  `docker-proxy`) is shown as "unknown process", not flagged. **The probes decide the verdict.**
  Listeners are supporting evidence only, so permission limits never produce a false alarm.
- **E10. No `curl`** → the probes are reported as *skipped*, like a missing `lsof`/`ss`.
- **E11. No listener visible but the probe succeeds** (e.g. Linux without the userland proxy) →
  fine. "No listener visible" is info, not a failure.
- Probe gets no answer → reported as a timeout, distinct from "answered by another service".
- No `lsof`/`ss` → that check is reported as skipped, not as a failure.
- Exit codes: see [Verdict and exit codes](#verdict-and-exit-codes).

## Backward compatibility

The command is additive: `status`, `up`, `logs` and the rest keep their behavior (except the one
hint line below), and the exit codes are new. It only reads: `docker inspect`, `vault compose ps`,
`curl`, `lsof`/`ss`. It consumes the `port_listeners` contract (`standalone/bin/kerghan`, marked
stable for this issue) as-is.

Surfaces to update:

- **Help text (`usage`)**: one line, `diagnose   check the instance end to end (read-only)`.
- **`main` dispatch**: `diagnose) cmd_diagnose ...`. Any argument is rejected with `usage_error`,
  like `status`.
- **Bash completion**: add `diagnose` to the hand-written command list (`completion_sync.bats`
  cross-checks it against `kerghan help`), and to the no-argument list in `completion.bats`
  edge 5 (next to `down` and `status`).
- **`up`'s port conflict warning** (`warn_port_conflict`, #595): add a hint line,
  `run 'kerghan diagnose' for details`, and update `port_conflict.bats`.

Older images (`image-tag=` can pin one):

- `/health.json` exists in every image. `/ready.json` exists since 0.5.0, before the standalone
  image. Still, a `404` on `/ready.json` is reported as *readiness unknown*, not as a failure.
- `compose ps` output depends on the Vault version. Parse only the service name and state/health.
  A row that cannot be parsed is reported as "unknown", not as a failure.

Docs:

- `docs/agents/standalone/client.md` command list and `README.md` (next to `kerghan status`).
- A new `docs/agents/standalone/client-diagnose.md`, following the `client-update.md` /
  `client-config.md` pattern: the checks, the probe/verdict table and the exit codes.
- Point to it from #595's macOS AirPlay section and from `release-and-caveats.md` ("if something
  looks wrong, run `kerghan diagnose`").

## Security & performance

### Performance

- Every probe uses `curl --connect-timeout 2 --max-time 3`.
- `/ready.json` is probed only when `/health.json` on the same address identified Kerghan. The
  worst case is about 4 requests (~12 s); the usual failures (refused, a foreign service
  answering) return almost immediately.
- `docker info`, `docker inspect` and `vault compose ps` are wrapped in `timeout` when it is on
  `PATH` (Linux, coreutils on macOS), and run unbounded otherwise. No pure-bash watchdog. A hung
  engine shows up as E2.
- No retries and no wait loop: the command reports the state as it is now.

### Security

- **Read-only, for real:** never call `ensure_env_file` or anything else that creates or edits
  `~/.kerghan/*`. A missing config or env file means "defaults". A test asserts `~/.kerghan` is
  unchanged after a run.
- **No secrets:** the output never prints `kerghan.env` values, and never dumps the container's
  `.Config.Env`. Only specific non-secret facts are shown: image, port, bind, auto-login,
  file-logs, log dir. The secret-sentinel test covers both `kerghan.env` and the container env.
- **Untrusted responses:** the answering process may not be Kerghan. Only the status code and the
  `Server` header are printed, with control characters stripped and the value cut to ~100 chars
  (no terminal escape injection). A foreign response body is never printed.
- **curl hardening:** `-q` (ignore `~/.curlrc`), `--noproxy '*'` (an `http_proxy` would otherwise
  route the `localhost` probe through the proxy: a wrong result and a leaked request), no `-L`,
  `--proto '=http,https'`, no cookies or auth. Only the public probe endpoints are called.
- **Paste-friendly output:** the log dir is shown as `~/...` when it is under `$HOME`, so the
  username is not exposed in pasted output. Bind IP and port are shown as they are.

## Scope

- A dedicated `kerghan diagnose` command, not a flag on `kerghan status`: `status` stays a cheap
  pass-through to `vault status`, and `diagnose` is the one command to point a user to ("run
  `kerghan diagnose` and paste the output").
- Human-readable output only, plus distinct exit codes for scripts. No `--json` or `--quiet` mode
  (a later issue if needed).
- In scope: read-only checks on the local host and the local Docker engine.

## Out of scope

- Fixing anything automatically: the command only reports.
- Server-side health changes, including an identity marker on `/health.json` (#609).
- Checking reachability from other machines on the LAN: the probes run from the host only.
- Running the diagnosis automatically from `kerghan up` (`up` already has #595's port conflict
  warning).

## Testing

bats tests with stubbed `docker`, `curl`, `vault` and `lsof`/`ss`. They run on bash 5 and bash 3.2
in CI, so `cmd_diagnose` must stay bash 3.2-safe (no associative arrays, no `mapfile`).

### Stub extensions

- **`curl`**: per-URL probe responses from the environment. For `/health.json` and `/ready.json`
  on a given host, the test sets status, body and `Server` header, or a timeout (exit 28) or
  connection refused (exit 7). The encoding is up to the implementer, e.g.
  `STUB_PROBE_127_0_0_1_HEALTH='200|{"status":"ok"}|Apache/2.4'`.
- **`docker`**: an absent container, and a stopped container's exit code. `STUB_RUNNING_STATE`,
  `STUB_RUNNING_HOST_IP`, `STUB_RUNNING_PORT` and `STUB_DOCKER_INFO_EXIT` already exist.
- **`vault`**: `compose ps` output per service (running, exited, unhealthy, an unparsable row).

### New `standalone/test/diagnose.bats`

| Group | Tests |
|---|---|
| Happy path | Healthy instance → `OK`, exit 0. Advertised URL equals the published one → only one probe logged. |
| Probe verdicts | Advertised answered by another service (AirTunes) → verdict + AirPlay hint + "reachable at". Advertised times out or refuses. Published answered by another service. Published times out. |
| Identity | Body mismatch with 200 → "another service". `/ready.json` 503 → "not ready (database)". `/ready.json` 404 → "readiness unknown", not a failure. |
| E1–E2 | Absent container, stopped container (exit code shown), `docker info` fails → each verdict and exit code. The other checks are not run (assert they are not logged). |
| E3 | `DOCKER_HOST=tcp://...` and `ssh://...` → probes and listeners skipped, and no `curl`/`lsof` call logged. |
| E4–E5 | `HostIp` empty or `0.0.0.0` → probe `127.0.0.1`. A LAN IP → probe that IP. |
| E6–E7 | `FRONTEND_BASE_URL=https://...` → printed, not probed. Config `port=` differs from the running port → note printed, the running port is probed. |
| E8 | `mysql` unhealthy, or `kerghan` exited → named in the verdict, exit non-zero. An unparsable `compose ps` row → "unknown". |
| E9 | `com.docker.backend`, `docker-proxy`, `OrbStack` → not flagged. `ControlCenter` on 5000 → flagged + AirPlay hint. Empty process name → "unknown process", not flagged. A flagged listener with a probe that succeeds → listener shown, verdict still OK. |
| E10–E11 | `curl` hidden → probes skipped. `lsof`/`ss` hidden → listeners skipped. No listener but probe OK → OK. |
| Logs | `file-logs=true` → the log dir is shown (from `running_log_dir`). File logs off → no log line. |
| Args | `kerghan diagnose foo` → usage error, exit 2. |
| Safety | Probe calls carry the timeout flags (`assert_logged` on `--max-time`). A `kerghan.env` seeded with sentinel secret values → none of them appear in the output. |

### Existing suites

- `port_conflict.bats`: expect the new `run 'kerghan diagnose' for details` hint line.
- `completion.bats` edge 5: add `diagnose`. `completion_sync.bats` needs no edit and passes once
  help and completion agree.
- `standalone/scripts/smoke_test.sh` is not changed: it drives the container directly, not through
  the client.

### Manual acceptance (before the #594 release, not a CI gate)

On macOS, with AirPlay Receiver on and port 5000: `kerghan diagnose` names AirPlay and points to the
working URL. With AirPlay off it reports `OK`.

## Agent

standalone.

## Benefits

- The #594 failure is found with one command instead of `lsof` and reading headers by hand.
- Users can paste one report into an issue, which makes support faster.
