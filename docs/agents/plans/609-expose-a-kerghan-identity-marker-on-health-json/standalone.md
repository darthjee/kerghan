# Standalone Plan: Expose a Kerghan identity marker on /health.json

Main plan: [plan.md](plan.md)

## Shared contracts

The standalone client and smoke test **consume** the probe bodies the backend produces:

```text
GET /health.json
  200 {"app":"kerghan","status":"ok","version":"<semver>"}

GET /ready.json
  200 {"app":"kerghan","status":"ok","version":"<semver>","checks":{"database":"up","workers":"up"}}
  200 {"app":"kerghan","status":"degraded","version":"<semver>","checks":{"database":"up","workers":"down"}}
  503 {"app":"kerghan","status":"error","version":"<semver>","checks":{"database":"down",...}}
```

Key order is not part of the contract. `version` may be absent. Bodies stay under `probe_http`'s 200-character cut.

Classification rules:

- Kerghan if the whitespace-stripped body contains `"app":"kerghan"`, whatever the status code.
- Kerghan (legacy image) if the code is `200` and the whitespace-stripped body is exactly `{"status":"ok"}`.
- Anything else is foreign (a different `app`, a `200` with any other body, any other code without the marker).
- A `5xx` with `"app":"kerghan"` is Kerghan with the backend down: `[FAIL]`, exit 4. This cannot occur until #613 but is handled now.
- `/ready.json`: `200` with `"status":"degraded"` is `[warn]` (workers down) and not a failure; any other `200` is ready; `503` is not ready (exit 4); anything else is `readiness unknown`.

## Steps

- [01 — Identify Kerghan by `app` in `diagnose`](standalone/01-diagnose-classify.md)
- [02 — Assert the marker in the smoke test](standalone/02-smoke-test.md)
- [03 — Update the diagnose docs](standalone/03-docs.md)

## CI Checks

- `standalone/test`: `bats standalone/test` (CircleCI: the bats job on `bats/bats:1.11.0`, plus the bash 3.2 job on `dockerfiles/bats_bash32`). Run it through docker, for example `docker run --rm -v "$PWD:/code" -w /code bats/bats:1.11.0 standalone/test`, never on the host.
- `standalone/scripts/smoke_test.sh`: `make standalone-smoke` (needs the standalone image built).

## Notes

- The client must stay bash 3.2 compatible and must not gain a `jq` dependency (it uses none today). Match on the whitespace-stripped body with `case` patterns, for example `*'"app":"kerghan"'*`. Because a foreign body is never printed, a substring match is enough: a foreign service echoing that exact string is not a realistic threat for a local diagnostic.
- `PROBE_BODY` already strips control characters and is never printed for a foreign service. Keep that guarantee.
- `diag_classify` currently returns `0` only for Kerghan. Add a way for the caller to tell "Kerghan, backend down" apart (for example `DIAG_ID=kerghan_down`), so `cmd_diagnose` skips the `/ready.json` probe and records exit 4.
