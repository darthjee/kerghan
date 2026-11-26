# Tests

Extend the stubs and add `standalone/test/diagnose.bats`, following the matrix in the issue's
`## Testing` section. Every test passes on bash 5 and bash 3.2.

## Stub extensions

- **`stubs/curl`**: add probe handling for `*/health.json` and `*/ready.json` before the
  "unexpected URL" fallback, keyed by host, e.g. `STUB_PROBE_<HOST>_<HEALTH|READY>` with
  `<status>|<body>|<server>`, or `timeout` (exit 28, `-w` prints `000`) or `refused` (exit 7).
  The host key normalizes `127.0.0.1` → `127_0_0_1` and `localhost` → `LOCALHOST`. Honor `-o`,
  `-D` and `-w '%{http_code}'`. Keep the existing release-URL behavior unchanged and document the
  new variables in the header comment.
- **`stubs/docker`**: an absent container (`STUB_CONTAINER_ABSENT=1` → `docker inspect` exits 1)
  and a stopped container's exit code (`STUB_RUNNING_EXIT_CODE`). `docker info` already has
  `STUB_DOCKER_INFO_EXIT`.
- **`stubs/vault`**: `compose ps` output from `STUB_COMPOSE_PS` (default: `tent`, `kerghan`,
  `mysql` running/healthy), in the format step 02 chose.
- A `timeout` on `PATH` must not be required by the tests: they cover the "no `timeout`" path by
  default, plus one test with a stub `timeout` that just runs its arguments (assert it was used).

## `diagnose.bats`

One test per row of the issue's matrix: happy path (one probe when the URLs are the same), probe
verdicts (AirTunes on `localhost`, advertised timeout or refused, published foreign or timeout),
identity (body mismatch, `/ready.json` 503 and 404), E1–E2 (with the later checks asserted *not*
logged), E3 (`tcp://` and `ssh://`, no `curl`/`lsof` logged, the label without user info), E4–E5,
E6–E7, E8 (unhealthy, exited, unparsable row), E9 (Docker names, `ControlCenter` + AirPlay hint,
empty name, a flagged listener with an OK verdict), E10–E11, logs (on/off, `~/` display), args
(exit 2), and safety:

- every probe call carries `--max-time`, `--noproxy` and `-q` (`assert_logged`);
- sentinel secrets in `kerghan.env` and in `STUB_RUNNING_ENV` never appear in the output;
- a `Server` header containing an escape sequence is printed without its control characters;
- `~/.kerghan` is unchanged after a run (compare a listing before and after; no `kerghan.env` is
  created when it was missing).

Assert the exit code of every case against the issue's table (0, 1, 2, 3, 4, 5, 6).

## Existing suites

- `port_conflict.bats`: expect the new `kerghan: hint: run 'kerghan diagnose' for details` line.
- `completion.bats` edge 5: add `diagnose` to the no-argument commands.
- `completion_sync.bats`: no edit expected. Fix anything it reports.
- Any `up` test that asserts the URL lines keeps passing unchanged (step 01 keeps the output the
  same).

## Files to Change

- `standalone/test/stubs/curl`, `standalone/test/stubs/docker`, `standalone/test/stubs/vault`:
  the extensions above.
- `standalone/test/diagnose.bats`: new.
- `standalone/test/port_conflict.bats`: the new hint line.
- `standalone/test/completion.bats`: edge 5.
