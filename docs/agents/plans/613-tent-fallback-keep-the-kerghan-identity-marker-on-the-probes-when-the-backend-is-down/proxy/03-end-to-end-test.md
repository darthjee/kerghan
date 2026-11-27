# End-to-end test against the real probes.php

Add `ProbeFallbackTest`, following `ClientIpForwardingTest` and `BackendSetCookieForwardingTest`: requests go through `RequestProcessor`, out over real curl, to `StubUpstreamServer`, and `ResponseSender` runs with a recording header emitter where the response headers need checking. Unlike those tests, it **loads the real rule file** instead of mirroring it.

- Resolve the root as `getenv('KERGHAN_REPO_ROOT') ?: '/kerghan'` (plan.md contract 3). A data provider yields the three trees: `dev` gives `proxy/dev_configuration`, `prod` gives `proxy/prod_configuration`, and `standalone` gives `standalone/vault/tent/configuration`. For each, reset Tent's `Configuration` rules (as the existing tests do in `setUp`/`tearDown`), set `$backendHost`, and `require` `<tree>/rules/probes.php` (not `require_once`, since it's loaded once per tree). A missing file is a test failure, not a skip.
- A separate test asserts that the three `probes.php` files are byte-identical (`hash_file('sha256', ...)` equal).
- New router `proxy/extension/tests/support/upstream/probe_router.php`, which takes its behaviour from a request header (e.g. `X-Probe-Mode`): `ok` returns `200 {"app":"kerghan","status":"ok","version":"0.0.0"}`; `not_ready` returns `503 {"app":"kerghan","status":"error",...}`; `not_found` returns `404`; `crash` returns `500 {"statusCode":500}`; `hang` does `sleep(4)` then `200`. It also sets a `Set-Cookie` and an `X-Powered-By` header on every answer, so header leaks would show.

Cases (each run against all three trees):

- **Unreachable:** `$backendHost` points at a free localhost port with nothing listening (reuse `StubUpstreamServer`'s free-port logic, or start and stop a stub). `GET /health.json` and `GET /ready.json` give `502` and the exact pinned body, with headers exactly the three from contract 1.
- **Hanging:** `hang` mode. `GET /health.json` gives `504` and the pinned body, and the elapsed time is **< 3.0s** (assert with `microtime(true)`). This is the diagnose `--max-time` invariant.
- **Passthrough:** `ok`, `not_ready`, `not_found` and `crash` reach the client with their status and body unchanged.
- **Matching:**
  - `HEAD /health.json` with the backend unreachable gives `502` and the rewritten headers.
  - `GET /health.json?x=1` with the backend unreachable gives the pinned body.
  - `POST /health.json` and `GET /HEALTH.json` are **not** handled by this rule: `RequestProcessor` with only the probe rule loaded returns Tent's missing or no-match response, not the pinned body.
- **No cache:** after an `ok` request, the test's cache folder (or `./cache` under the working dir) has no entry for the probe.

Docblock: explain why this test loads the real file (it locks the shipped timeouts and the byte-identity requirement), and point at #619 for moving the other end-to-end tests to the same approach.

## Files to Change

- `proxy/extension/tests/proxy/ProbeFallbackTest.php`: new.
- `proxy/extension/tests/support/upstream/probe_router.php`: new.
