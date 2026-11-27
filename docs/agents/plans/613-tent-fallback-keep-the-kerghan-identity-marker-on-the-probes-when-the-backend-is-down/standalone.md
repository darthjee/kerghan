# Standalone Plan: Tent fallback: keep the Kerghan identity marker on the probes when the backend is down

Main plan: [plan.md](plan.md)

## Shared contracts

- **Produces** `standalone/vault/tent/configuration/rules/probes.php`, **byte-identical** to the proxy agent's `proxy/prod_configuration/rules/probes.php` ([plan.md contract 2](plan.md#2-rulesprobesphp-proxy-writes-dev-and-prod-standalone-writes-the-standalone-copy)). The proxy end-to-end test asserts the three copies match and runs every case against this one too.
- **Relies on** `Tent\Middlewares\ProbeFallbackMiddleware` from `proxy/extension/lib/`, which the standalone Dockerfile already copies to `/vault/tent/extension/lib/`, with `loader.php` alongside. No Dockerfile change.
- **Pinned bodies** the client must classify as `kerghan_down`: `/health.json` gives `{"app":"kerghan","status":"down"}` with `502` or `504`.
- **Timeout invariant** ([contract 4](plan.md#4-timeout-invariant-proxy-and-standalone)): `probe_http`'s `--max-time 3` stays above the probe rule's `timeout: 2`.

## Implementation Steps

### Step 1 — Standalone probes rule

Copy the proxy agent's `proxy/prod_configuration/rules/probes.php` byte-for-byte to `standalone/vault/tent/configuration/rules/probes.php`, and require it from `standalone/vault/tent/configuration/configure.php` between `rules/frontend.php` and `rules/backend.php`, with the same one-line comment as the proxy trees. Don't edit the copy independently: a divergence from prod is a bug, and `ProbeFallbackTest` fails on it. `$backendHost` is already defined by the standalone `locals.php`, the same as in prod.

### Step 2 — diagnose: 504 case, invariant comment, docs

- `standalone/test/diagnose.bats`: next to the existing "a 502 with app kerghan: backend down, exit 4, /ready.json not probed" case, add its `504` twin (`STUB_PROBE_127_0_0_1_HEALTH='504|{"app":"kerghan","status":"down"}|Apache'`). Expect exit 4, the `[FAIL] ... Kerghan proxy answered 504, backend down (Server: Apache)` line and the same verdict, with no "another service" and no `ready.json` probe. No client code change is expected: `diag_classify` already maps any `5??` with the marker to `kerghan_down`.
- `standalone/bin/kerghan`, in the `probe_http` comment: add that `--max-time 3` must stay strictly above the Tent probe rule's `timeout` (2s, in `rules/probes.php` in all three trees), so a hung backend gets Tent's `504` + marker before curl gives up. Change both together.
- `docs/agents/standalone/client-diagnose.md`:
  - The backend-down row now covers the backend being unreachable (`502`) or hung (`504`), both answered by the proxy with the marker.
  - Document the timeout invariant.
  - List `status: "down"` and `checks.*: "unknown"` as values only the proxy emits.

## Files to Change

- `standalone/vault/tent/configuration/rules/probes.php`: new, byte-identical to prod.
- `standalone/vault/tent/configuration/configure.php`: require it between frontend and backend.
- `standalone/test/diagnose.bats`: `504` + marker case.
- `standalone/bin/kerghan`: comment only, on `probe_http`.
- `docs/agents/standalone/client-diagnose.md`: backend-down cases, invariant, proxy-only values.

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`)
- `standalone/`: `docker-compose run --rm standalone_tests_bash32` (CI job: `standalone_tests_bash32`)

## Notes

- Write Step 1 after the proxy agent's prod `probes.php` exists, or copy the exact contract 2 shape and docblock. Either way, the files must end up byte-identical.
- `make standalone-smoke` is not changed: the backend is up there, so probes pass through untouched.
