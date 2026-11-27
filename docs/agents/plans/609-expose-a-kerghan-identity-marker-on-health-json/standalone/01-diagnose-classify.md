# Identify Kerghan by `app` in `diagnose`

`diag_classify` (in `standalone/bin/kerghan`, around line 2342) identifies Kerghan only by a `200` with the exact body `{"status":"ok"}`. Replace that with the classification rules from [standalone.md](../standalone.md#shared-contracts):

- Strip whitespace from `PROBE_BODY` as today.
- Any numeric status with `"app":"kerghan"` in the body:
  - `2xx`: `DIAG_ID=kerghan`, `DIAG_DESC="Kerghan<version><server>"`. Append ` <version>` when a `"version":"<semver>"` can be extracted and matches `^[0-9]+\.[0-9]+\.[0-9]+$`; otherwise append nothing. Never print an unvalidated value.
  - `5xx`: `DIAG_ID=kerghan_down`, `DIAG_DESC="Kerghan proxy answered <code>, backend down<server>"`.
  - other codes: treat as Kerghan with the code shown (`DIAG_ID=kerghan`), so a future marker on an unexpected code is still attributed correctly.
- `200` with the exact legacy body `{"status":"ok"}`: `DIAG_ID=kerghan` (legacy image).
- Everything else keeps today's `foreign` / `none` handling.

In `cmd_diagnose` (around line 2546), wherever `diag_classify` drives the published and advertised URL lines:

- `kerghan`: unchanged `[ok]` line, then `/ready.json`. A `200` whose stripped body contains `"status":"degraded"` prints `[warn] .../ready.json   degraded (workers)` and does **not** fail the run. Any other `200` is `ready`; `503` keeps `not ready (database)` and exit 4; anything else is `readiness unknown`.
- `kerghan_down`: `[FAIL]` line, `diag_fail 4` with the logs hint, and no `/ready.json` probe.
- Update the comment block above `diag_classify` (the header comment still says "exact body").
- Check for a `[warn]` level in the existing `diag_line` usage. If none exists, use `[info]` to avoid introducing a new level, and say so in the docs step.

Tests in `standalone/test/diagnose.bats`, using the existing curl stub helpers (`standalone/test/stubs`, `standalone/test/helpers`):

- a `200` with `{"app":"kerghan","status":"ok","version":"0.11.0"}` is Kerghan, OK, exit 0, and shows the version;
- a `200` with the legacy `{"status":"ok"}` is Kerghan (keep the existing healthy-instance tests passing unchanged);
- a `200` with `{"app":"other","status":"ok"}` is another service, exit 5;
- a `200` with `{"app":"kerghan","status":"ok","version":"$(evil)"}` does not print the invalid version;
- a `502` with `{"app":"kerghan","status":"down"}` reports Kerghan with the backend down, exit 4, and never probes `/ready.json`;
- a `/ready.json` `200` with `"status":"degraded"` is reported and the run exits 0;
- the existing `503` and `404` `/ready.json` tests keep passing.

Run the suite on both bats jobs (bats 1.11.0 and bash 3.2).

## Files to Change

- `standalone/bin/kerghan` — `diag_classify` rules, `cmd_diagnose` handling of `kerghan_down` and `degraded`, comments
- `standalone/test/diagnose.bats` — the cases above
- `standalone/test/stubs/*` / `standalone/test/helpers/*` — only if the curl stub cannot already return an arbitrary status and body per URL
