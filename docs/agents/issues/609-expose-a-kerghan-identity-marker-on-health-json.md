# Expose a Kerghan identity marker on /health.json

Related to #597 (`kerghan diagnose`). Spawned from #597.

## Problem

Nothing in a Kerghan response proves the responder is Kerghan. `GET /health.json` answers `{"status":"ok"}` (`backend/src/health/health.controller.ts`) and Tent adds a generic `Server: Apache/...` header. A client that must tell "Kerghan answered" from "another service on the same port answered" — the #594 AirPlay case, where macOS `AirPlay Receiver` answered `localhost:5000` with `403` and `Server: AirTunes` and never reaches the server — has only that generic body and header to match.

The consequence is concrete: `cmd_diagnose` in `standalone/bin/kerghan` (function `diag_classify`) identifies Kerghan by a `200` with the byte-exact body `{"status":"ok"}`. Any other service that answers `200 {"status":"ok"}` on the port is reported as Kerghan, and when the backend is down Kerghan's own proxy answers an empty `200` (see [Tent prerequisite](#tent-prerequisite-handled-in-613)), which is reported as a foreign service.

The probe also says nothing about the components inside: the database and the worker pool are invisible to it, so `diag_service` has to parse `vault compose ps` to learn that `mysql` is unhealthy.

## Current behaviour (reference)

| Location | Behaviour today |
|---|---|
| `backend/src/health/health.controller.ts` | `@Controller() @CachePolicy(CacheClass.Never)`; `GET health.json` is `@Public()`, `@HttpCode(200)`, returns `{ status: 'ok' }` and touches no dependency. `GET ready.json` is `@Public()`, delegates to `HealthService#checkReadiness`, and sets `200`/`503` on the response through `@Res({ passthrough: true })` so `HttpExceptionFilter` cannot reshape the body. |
| `backend/src/health/health.service.ts` | `checkReadiness()` builds `checks: { database: 'up' \| 'down' }` from one `SELECT 1` through the injected TypeORM `DataSource`, aggregates with `Object.values(checks).every(...)` and returns `{ status: 'ok' \| 'error', checks }`. Failures are logged through `LoggerService` and never returned. SMTP and the GitHub API are deliberately not checked. |
| `standalone/bin/kerghan` (`diag_classify`) | Identifies Kerghan by a `200` with the exact body `{"status":"ok"}`; the `Server` header is printed and never used to decide. `/ready.json` is probed after that: `200` ready, `503` not ready (exit 4), anything else such as `404` on an old image is `readiness unknown`. |
| `proxy/prod_configuration/rules/backend.php` | One rule: `default_proxy` to the backend host for every URI `ends_with` `.json`, with `SetClientIpMiddleware`, `CacheCleanupMiddleware` and `CacheStalenessMiddleware` (`maxAgeSeconds: 10`). Every 2xx `.json` response is shared-cached unless it carries `X-Skip-Cache`. |
| `proxy/prod_configuration/configure.php` | Requires `rules/frontend.php`, then `rules/backend.php`, then `rules/redirects.php`. Order is significant and `backend.php` matches every `*.json`, so a rule loaded after it never sees `/health.json`. |
| `proxy/extension/lib/middlewares/SetResponseHeadersMiddleware.php` | Replaces a configured map of response headers; used by `rules/frontend.php` for CSP and `Cache-Control`. It cannot change the response body or the status code. |
| `docs/agents/architecture/backend/request-pipeline.md` | Documents both probes as public and `never`-cached, and states that liveness "touches no dependency". |
| `standalone/scripts/smoke_test.sh` | Uses `wait_for_200 "$BASE_URL/health.json"` as its only readiness gate before checking `/`. |
| `docs/agents/architecture/security.md` | Records that `GET` routes must not change state, and that `/ready.json` "exposes only per-check `up`/`down` states, never error details". |

## Proposal

```text
GET /health.json   (identity + liveness)

  200 {"app":"kerghan","status":"ok","version":"0.10.2"}

GET /ready.json    (readiness + component checks)

  200 {"app":"kerghan","status":"ok","version":"0.10.2","checks":{"database":"up","workers":"up"}}
  200 {"app":"kerghan","status":"degraded","version":"0.10.2","checks":{"database":"up","workers":"down"}}
  503 {"app":"kerghan","status":"error","version":"0.10.2","checks":{"database":"down","workers":"up"}}
```

The backend-down case (Tent synthesizing `502`/`504` `{"app":"kerghan","status":"down"}`) is split into #613, which is blocked on darthjee/tent#315. This issue reserves the `down` status and the `unknown` check state for #613, and teaches `kerghan diagnose` to read them now, so the client is ready before the proxy side lands.

### Semantics

1. `app` is the fixed literal `"kerghan"` on every answer, success or failure. It is the identity marker: a client checks `app`, not the status code, not the `Server` header.
2. `version` is the release semver, read once at boot from `backend/package.json` — the file `scripts/bump_version.sh` rewrites in lockstep with the README, the client, the installer and the image tags, so it already lives inside the image. It is omitted when that file cannot be read, and always omitted from a Tent-synthesized body, because Tent does not know the release.
3. `status` is one of `ok`, `degraded`, `down`, `error`. `ok`: every check up. `degraded`: a non-fatal dependency is down and the backend still serves. `error`: the database is down and the backend cannot serve. `down`: the backend did not answer and Tent synthesized the body.
4. `checks` carries one entry per component, each `up`, `down`, `degraded` or `unknown`. Today: `database` and `workers`. `unknown` means "could not be determined" — the Tent fallback, and any check that did not run.
5. Keys are additive only. `app`, `status` and `version` keep their names and meanings; a new component is a new `checks` key, never a new top-level field.
6. `status` stays derived from `checks`: `error` when `database` is not `up`, `degraded` when `workers` is not `up`, `ok` otherwise. The backend never sets `down` itself.

### Cycle and HTTP codes

- `/health.json` answers `200` whenever the backend answers at all, even when `checks` reports a dependency down: it is identity and liveness, the process is up. The dependency verdict belongs to `/ready.json`.
- `/ready.json` answers `200` for `ok` and `degraded`, and `503` for `error`. The status is set on the response with `@Res({ passthrough: true })`, never thrown, so `HttpExceptionFilter` cannot reshape the body.
### Tent prerequisite (handled in #613)

Verified against `darthjee/tent:1.0.3`: with the backend unreachable, Tent answers an **empty `200`** (`curl_exec()` fails, `httpCode` is `0`, `http_response_code(0)` is ignored by PHP, and Apache sends `200 OK` with `Content-Length: 0`). It sets no curl timeouts, so it never answers `504`. darthjee/tent#315 fixes that upstream, and #613 adds the probe fallback on top of it. Until both land, `kerghan diagnose` keeps seeing an empty `200` when the backend is down and reports it as a foreign service, as it does today.

### Release timing

`kerghan diagnose` (#610) is not in any release yet (latest tag `0.10.2`). This issue should ship in the same release as #610, so that no released client ever carries the exact-body `{"status":"ok"}` check that would reject the new body as foreign.

## Expected

- `curl -s http://localhost:3000/health.json` on a healthy instance returns `app == "kerghan"`, `status == "ok"` and a `version` matching `backend/package.json`.
- `/ready.json` returns `200` with `checks.workers == "down"`, `status == "degraded"` when the worker pool is not running and the database is up, and `503` with `checks.database == "down"`, `status == "error"` when the database is down.
- No response carries an error message, host, stack trace, credential or any other internal detail; failures keep going to `LoggerService`.
- `kerghan diagnose` identifies Kerghan both against an instance running this release and against an older image without `app`, and keeps today's exit codes for healthy and unhealthy instances. A `degraded` `/ready.json` is reported without failing the run, and a `5xx` JSON body with `app: "kerghan"` is reported as "Kerghan, backend down" (exit 4), ready for #613.
- `/health.json` and `/ready.json` are never answered from Tent's cache (the backend keeps `CacheClass.Never`, so both carry `X-Skip-Cache`).

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Marker carrier | `app` field in the body of both probes | The body is what `diag_classify` already reads. A header would need a second mechanism and would not survive a body-rewriting proxy. Accepted cost: the published exact-body match in `diag_classify` changes in the same PR. |
| Version source | Release semver from `backend/package.json`, read at boot | `scripts/bump_version.sh` already writes the release there, so it ships inside the image with no environment contract, no allowlist entry and no CI change. A public release tag is not a secret. |
| Version on an unauthenticated probe | Kept, recorded in `docs/agents/architecture/security.md` | The repository is open source and the release semver is already public (README, image tags, installer), so `version` only says which public release answers. Tent responses already carry more precise runtime versions (`Server: Apache/2.4.68 (Debian)`, `X-Powered-By: PHP/8.4.26`); hardening those headers is out of scope here. The probes expose nothing beyond `app`, `status`, `version` and per-check states. |
| Version as an env var | Rejected | It would add a variable to `environment-variables/backend.md`, to the standalone `kerghan` service allowlist and to every build path (`release_kerghan/Dockerfile`, `kerghan_standalone/Dockerfile`, the CircleCI release jobs), and a settable env value can claim a version the image is not. |
| Who synthesizes the backend-down body | Tent, for `5xx` only, split into #613 | Tent is the only layer that still answers when the backend is down. Splitting it out lets the backend and client parts ship now, while #613 waits on darthjee/tent#315. |
| Where the component checks live | `checks` on `/ready.json` only | Keeps `/health.json` a liveness probe, as `request-pipeline.md` documents, and keeps `smoke_test.sh`'s `wait_for_200` a liveness gate rather than an implicit database wait. |
| Non-fatal dependency down | New `degraded` status, `200` | The worker pool only syncs linked issues. A `503` would make `kerghan diagnose` exit 4 and mark a working instance unhealthy. |
| Meaning of the `workers` check | The engine is running: `onApplicationBootstrap` started it and its run promise has not settled | `WorkersService` catches and logs an engine crash and never restarts the engine, so "registered and not shutting down" would read `up` for a dead pool, the case most worth surfacing. A crash, a clean exit of `engine.start()` or shutdown all read `down`. Queue depth and job failures are metrics, not health: a backlog must not flap the probe. |
| `/health.json` code when the database is down | `200` | The process is up and reachable; the dependency verdict belongs to `/ready.json`. |
| `/ready.json` | Kept, unchanged in shape | `diagnose` already consumes it and removing it buys nothing. Removal is out of scope. |

### Edge cases (pinned)

- **Backend unreachable or timing out**: out of scope here (#613). Until #613 lands, Tent answers an empty `200`, which `diagnose` keeps reporting as foreign. `diag_classify` already reads a `5xx` with `app: "kerghan"` as Kerghan with the backend down.
- **Database down**: `/ready.json` `503`, `status: "error"`, `checks.database: "down"`, `checks.workers` still reported as measured.
- **Worker pool in bounded shutdown drain**: `workers: "down"`, `status: "degraded"`, `200`.
- **Worker engine crashed** (logged, never restarted): `workers: "down"`, `status: "degraded"`, `200`, for the rest of the process lifetime.
- **`backend/package.json` unreadable**: `version` is omitted, every other field is normal, and the probe never fails because of it.
- **Older image without `app`**: `diag_classify` still accepts a `200` with `{"status":"ok"}` and no `app` as Kerghan, so `diagnose` keeps working against already released images.
- **Foreign service answering `200 {"status":"ok"}`**: reported as foreign. Absence of `app` now means "not Kerghan".
- **`/ready.json` answering `404` on an old image**: still `readiness unknown`, never a failure.
- **Probe answered from cache**: impossible; the backend keeps `CacheClass.Never`, so the proxy never caches either probe.

## Implementation notes

- `HealthService` gains the component checks and the `app`/`version`/aggregation logic; `HealthController` stays thin. Keep both under the 300-line and complexity-10 ESLint limits by putting the status derivation in a small helper instead of a nested conditional chain.
- Reading `backend/package.json` from `dist/` follows the precedent already used by the mail template registry: resolve the directory through `import.meta.url`. It is a boot-time read, cached, never per request.
- The `workers` check needs a status accessor on `WorkersService`. Its exported surface today is `register` and `enqueue`. Add `isRunning(): boolean`, backed by a private state that is set to running when `onApplicationBootstrap` starts the engine and cleared when `#run` settles (the crash `catch` and a clean resolve) and when `onApplicationShutdown` begins. Do not read `deku-swarm` registries from `health`. Document the accessor in `docs/agents/modules/workers.md`. `health` consuming `workers` is a new inter-module dependency and must be justified there against the modular-pattern rules (read-only, one boolean, no job data).
- `diag_classify` in `standalone/bin/kerghan`: parse the body as JSON instead of matching bytes. Kerghan when `app == "kerghan"` (any status code), or when the code is `200` with `status == "ok"` and no `app` (legacy images). A different `app`, or anything else, is foreign. A `5xx` with `app: "kerghan"` is Kerghan with the backend down: `[FAIL]`, exit 4. The `/ready.json` handling adds `degraded` as `[warn]` (workers down), not a failure. Keep the client free of new runtime dependencies (no `jq` unless it is already required).
- No proxy change in this issue: the Tent rule, the middleware and the Tent image bump are #613.
- Documentation to update in the same PR: `docs/agents/architecture/backend/request-pipeline.md` (probe table and the liveness sentence), `docs/agents/architecture/security.md` (the `GET` routes note, plus a new note that the probes publish the release semver by design and nothing else: no host, error, stack or credential), `docs/agents/standalone/client-diagnose.md` (identification by `app`, the new `degraded` case). `docs/agents/environment-variables.md` changes only if a variable is actually added; with the decisions above, none is.
- No `.json` routing convention change: both paths already end in `.json`.

## Testing

- `backend/src/health/tests/health.service.spec.ts`: every combination of `database` and `workers` states maps to the expected `status`; a throwing `DataSource.query` yields `database: "down"` and logs once; an unreadable `package.json` omits `version` without throwing.
- `backend/src/workers/tests/workers.service.spec.ts`: `isRunning()` is `false` before bootstrap, `true` after `onApplicationBootstrap`, `false` once the engine promise rejects (crash) or resolves, and `false` from the start of `onApplicationShutdown`.
- `backend/src/health/tests/health.controller.spec.ts`: `GET /health.json` returns `app` and `status`; `GET /ready.json` sets `200` for `ok` and `degraded` and `503` for `error` on the response, keeping the probe body instead of the standard error shape; both routes keep `CacheClass.Never`.
- `standalone/test/diagnose.bats`: a `200` with `app: "kerghan"` is Kerghan; a `200` with the old `{"status":"ok"}` and no `app` is Kerghan; a `200` with a different `app` is foreign; a `502` with `app: "kerghan"` reports Kerghan with the backend down and exits 4; a `degraded` `/ready.json` does not fail the run.
- `standalone/scripts/smoke_test.sh`: keep waiting on `/health.json`, and assert that its body carries `app: "kerghan"` and a non-empty `version`.

## Context

Spawned from #597 (`kerghan diagnose`), which shipped the client-side identity check first. Sub-issue: #613 (Tent fallback for the backend-down case, blocked on darthjee/tent#315). Related: #594 (the AirPlay case that motivated it), #598 (advertised URL), #601 (loopback cookie fix). Affected packages: `backend` (health and workers modules), `standalone` (client, diagnose tests, smoke test), `docs`. Out of scope: any proxy change (#613), using the marker anywhere else, and removing `/ready.json`.

## Files in the sandbox

- (no files were attached)
