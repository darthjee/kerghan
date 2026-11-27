# Issue: Tent fallback: keep the Kerghan identity marker on the probes when the backend is down

## Description

Split from #609. **Blocked until Kerghan runs Tent `>= 1.4.0`** (the first release shipping darthjee/tent#315, merged in darthjee/tent#318 after `1.3.0`). The bump itself is #617; this issue starts only once #617 is merged.

## Problem

#609 makes the backend answer both probes with an `app: "kerghan"` identity marker. When the backend is down, though, the backend does not answer, and the identity is lost exactly when it matters most for `kerghan diagnose`.

Verified against `darthjee/tent:1.0.3`: with the backend unreachable, Tent answers an **empty `200`** (`curl_exec()` fails, `httpCode` is `0`, `http_response_code(0)` is ignored, and Apache sends `200 OK` with `Content-Length: 0`). It sets no curl timeouts, so it never answers `504`. darthjee/tent#315 fixes that upstream: an empty `502` on a connection failure, an empty `504` on a timeout, and configurable `connect_timeout`/`timeout` on the proxy handlers. Its `502`/`504` carry no marker distinguishing them from an upstream `502`/`504`.

## Expected Behavior

- With the backend stopped and Tent running, `/health.json` returns `502` with `app == "kerghan"` and `status == "down"`: never an empty body, never `200`.
- With the backend hanging, the same with `504`, answered within the probe rule's 2s `timeout` (below diagnose's 3s `--max-time`).
- `/ready.json` under the same conditions returns the pinned body with both `checks` entries `unknown`.
- A synthesized body carries no curl error, host or other internal detail, and is never built from request input.
- `kerghan diagnose` (already taught by #609 to read a `5xx` with `app: "kerghan"` as "Kerghan, backend down") reports this case and exits 4.

## Solution

Once #617 has moved Kerghan to Tent `>= 1.4.0`, Kerghan's proxy synthesizes the probe body on a backend failure:

```text
GET /health.json
  502 {"app":"kerghan","status":"down"}    <- backend unreachable
  504 {"app":"kerghan","status":"down"}    <- backend timeout

GET /ready.json
  502 {"app":"kerghan","status":"down","checks":{"database":"unknown","workers":"unknown"}}
  504 {"app":"kerghan","status":"down","checks":{"database":"unknown","workers":"unknown"}}
```

- A new rule matching exactly `/health.json` and `/ready.json` is loaded **before** `rules/backend.php` (which matches every `*.json`, so a later rule never sees the probes) in all three `configure.php` trees: `proxy/dev_configuration/`, `proxy/prod_configuration/` and `standalone/vault/tent/configuration/`. A divergence between the standalone copy and `prod_configuration` is a bug.
- The rule proxies normally. On a `5xx` from Tent (`502`, `504`) it replaces the body with the fixed JSON for the requested endpoint and sets `Content-Type: application/json` and `Cache-Control: no-store`. It never special-cases `httpCode 0`: that is Tent's job (#315).
- The status code is kept: the proxy never turns a failure into a `200`.
- A `4xx` is a real backend answer and passes through untouched. So do a `2xx` and the backend's own `503` from `/ready.json`, which already carries `app: "kerghan"`. Only a Tent-originated `502`/`504` is rewritten. Tent cannot tell its own `502` from an upstream `502`, so both are rewritten. That is acceptable, since the backend never sends `502`/`504` itself.
- `version` is never present in a synthesized body: Tent does not know the release.
- **Proxy-only vocabulary.** The synthesized bodies use two values the backend never emits: `status: "down"` (the backend's liveness `status` is only `ok`, and its readiness `ProbeStatus` is `ok | degraded | error`) and `checks.*: "unknown"` (the backend's `CheckState` is `up | down`). This is deliberate. The proxy cannot know the database's or workers' state, and the status code already signals the failure. The backend types are not widened. The docs list both values as emitted only by the proxy.
- `SetResponseHeadersMiddleware` cannot do this: it only sets response headers, never the body, and it can't drop upstream headers. Add a new middleware under `proxy/extension/lib/middlewares/`, required from `proxy/extension/loader.php` next to the existing ones and used only by the probe rule.

### Alternatives considered

**Chosen: a probe rule plus a Kerghan fallback middleware** (this issue). It needs nothing upstream beyond darthjee/tent#315, ships with Kerghan, and gives the probes their own timeouts.

Rejected:

- **A Tent-level per-rule `on_failure` fallback** (status, body and headers set in the handler config). Cleaner and reusable, but it would wait on another Tent release after `1.4.0`. This issue's middleware is a small Kerghan-side version of the same idea. If Tent ever ships it, the middleware can be replaced. No Tent issue is opened for now, since nothing else needs it yet.
- **Tent answering `/health.json` itself** (`FixedFileHandler` with a static body). Liveness would mean "Tent is up", not "the backend is up", which defeats the probe and drops #609's `version`.
- **A static identity file plus a client change** (Tent serves e.g. `/kerghan.json`; diagnose probes it when `/health.json` fails). It avoids rewriting bodies, but needs a second probe and a client release, changes #609's body contract, and only helps `kerghan diagnose`: other monitors still get an anonymous empty `502`.
- **A response-header marker** (`X-Kerghan-App` on every Tent response). This is doable with the existing `SetResponseHeadersMiddleware`, with no new middleware. It is rejected because it moves #609's contract from the body to a header (a client change, and monitors that only read bodies stay blind) and fingerprints every response instead of just the probes.

### Scope

**In scope**

- One new rule file, `rules/probes.php`, required between `rules/frontend.php` and `rules/backend.php` in all three `configure.php` trees. It has four `exact` matchers, `GET` and `HEAD` for each of `/health.json` and `/ready.json`. Tent OR's a rule's matchers, and `exact` compares the path without the query string, so `/health.json?x=1` still matches. See [Edge cases](#edge-cases).
- The rule mirrors `backend.php`'s proxying so the backend sees the same request as today: the same `default_proxy` handler and `$backendHost`, `CanonicalHostHeaderMiddleware` in `prependMiddlewares`, and `SetClientIpMiddleware`.
- It deliberately leaves out `CacheCleanupMiddleware` and `CacheStalenessMiddleware`: the probes are never cached (the backend already sends `X-Skip-Cache`), so those middlewares would add nothing.
- The rule sets its own short timeouts on the handler: `connect_timeout: 1` and `timeout: 2` (seconds), independent of the values #617 sets on the API rules. See [Backward compatibility](#backward-compatibility).
- It adds the new fallback middleware (the `502`/`504` rewrite with `no-store`), with its `loader.php` require, specs and docs.

**Out of scope**

- A JSON error body for other `*.json` routes when the backend is down. After #617 they answer an empty `502`/`504`, which `ApiClient` already treats as an error. A friendlier UI message is #618, done in the frontend from the status code alone, with no proxy change.
- Any change to the backend's own probe bodies or to `kerghan diagnose`. #609 already reads a `5xx` with `app: "kerghan"`: verify it, don't change it.
- The Tent bump and the timeout values (#617).
- Render health-check configuration.

### Backward compatibility

What each probe consumer sees when the backend is down:

| Consumer | Today (Tent `1.3.0`) | After this issue |
| --- | --- | --- |
| `kerghan diagnose`, backend unreachable | empty `200`, misclassified as `foreign` | `502` + `app:"kerghan"`, so `kerghan_down`, exit 4. No client change needed. |
| `kerghan diagnose`, backend hanging | Tent never answers. Diagnose's curl gives up at `--max-time 3` and reports `none` ("no answer (timeout)"). | `504` + `app:"kerghan"` within 2s, so `kerghan_down`, exit 4 |
| `make standalone-smoke` | probes with the backend up | unchanged (`2xx` passes through) |
| Render health check | probes the backend directly (the Render image is the backend alone, with no Tent in front) | unaffected |

**Probe timeouts.** The `504` case only works if Tent gives up before the client does. Diagnose's `probe_http` uses `--connect-timeout 2 --max-time 3`, so the probe rule sets `connect_timeout: 1` and `timeout: 2` instead of inheriting #617's API-rule timeout (Tent's default is `30`).

- **Invariant:** the probe rule's `timeout` stays strictly below diagnose's `--max-time`. Both places carry a comment pointing at the other (same pattern as `maxAgeSeconds` and `PUBLIC_MAX_AGE_SECONDS` in `backend.php`). Changing one means changing both.
- **Accepted side effect:** `/ready.json` runs `SELECT 1` with no timeout of its own. With a hung database it now answers, after 2s, `504` with both `checks` `unknown`, instead of hanging. Diagnose then reports "Kerghan, backend down" rather than "not ready (database)". That's less specific but correct.
- **Rejected alternative:** keep the API-rule timeout on the probes and raise diagnose's `--max-time` to match. Diagnose would wait up to 30s or more per probe.

### Edge cases

1. **Query string** (`/health.json?x=1`): matches, since `ExactRequestMatcher` compares `requestPath()` (the URL path only). Asserted in the spec.
2. **Near-miss paths** (`/HEALTH.json`, `/api/health.json`, `/health.json/`): no match (`exact` is case-sensitive). They fall through to `backend.php`, or to the frontend rule for the trailing slash, as today.
3. **Methods**: only `GET` and `HEAD` match. Any other method (e.g. `POST /health.json`) falls through to `backend.php`: an empty `502` after #617 with the backend down, or Nest's `404` with it up. It never gets the `status: down` body.
4. **`HEAD`**: a rewritten `HEAD` keeps the synthesized status and headers, with no body (Apache drops it). Asserted in the spec (status and headers) and in the integration test (`502`, empty body).
5. **Headers on a rewrite**: the middleware drops every upstream header and sends exactly `Content-Type: application/json`, `Cache-Control: no-store` and a `Content-Length` matching the synthesized body, so no `Set-Cookie`, `Server`, `X-Powered-By` or stale `Content-Length: 0` survives.
6. **`500`** (a Nest crash, or Tent clamping an invalid status since darthjee/tent#318): **not rewritten**. It is a real answer, and widening the rewrite to every `5xx` would hide backend bugs. Known gap: diagnose reports such a `500` as `foreign`, because it has no marker.
7. **Backend booting** (`kerghan start`, restarts): connections are refused, so the probes answer `502` + `down`. Accurate, with no special case.
8. **`200` without the marker** (an older backend image): passes through untouched. Diagnose's legacy `{"status":"ok"}` branch still handles it.

### Performance and security

**Security**

- The synthesized body is a fixed constant per probe, chosen by which matcher hit. It is never built from the request URI, query or headers, so no client input is echoed. Tent (darthjee/tent#318) already keeps curl errors and host details out of the result (log only, without the query string). The new middleware logs nothing.
- A rewrite drops every upstream header (see [Edge cases](#edge-cases), item 5).
- `app: "kerghan"` while the backend is down reveals nothing beyond what #609 already exposes, and `version` is never synthesized.
- No cache poisoning: the probe rule has no cache middleware and is matched before `backend.php`, so Tent's file cache never sees a probe. The synthesized response is `no-store`, so no CDN or browser keeps serving a "down" answer after recovery. The backend's `never` cache class (`X-Skip-Cache`) is unchanged.
- The PR gets a **security** agent review (it touches Tent rules), and a **cache** agent check that the probe rule carries no cache middleware.

**Performance**

- **Worker hold time.** With a hung backend, Tent `1.3.0` holds an Apache/PHP worker per probe indefinitely. After #617 alone it would hold one for up to its `timeout` (Tent's default is 30s). The probe rule's `timeout: 2` caps it at about 2s on the paths health checkers poll most while the backend is unhealthy. That limits how far a probe flood can use up the pool and take down the static frontend too.
- Not addressed here: non-probe `.json` routes still hold workers for #617's `timeout` (noted on #617), and there is no rate limiting (Tent has no rate-limit middleware, and the backend's limits don't help when the backend is hung). Not pursued until there is evidence of abuse.
- The rewrite itself costs a status check and a constant string, only on `502`/`504`. `/ready.json` still runs one `SELECT 1` per call, with no new retries.

### Tent version

Out of scope here: the Tent bump to `>= 1.4.0` (via `scripts/bump_tent.sh`) and the explicit `connect_timeout`/`timeout` on the backend proxy rules are both done in #617, which this issue depends on. This issue only adds the probe rule and its middleware on top. It never edits the `tent=` pin.

### Testing

Three layers, all run through docker-compose.

**1. Unit: `proxy/extension/tests/middlewares/ProbeFallbackMiddlewareTest.php`** (in-memory responses into `processResponse`)

- `502` and `504` on each probe path are replaced with the pinned body for that path.
- `200`, `503` (with body), `404` and `500` pass through byte-for-byte.
- A rewrite drops every upstream header (`Set-Cookie`, `Server`, `Content-Length: 0`). It sets exactly `Content-Type: application/json`, `Cache-Control: no-store` and a correct `Content-Length`, with no inner error detail.
- The body is the same whatever the request's query string or headers.

**2. End-to-end in `proxy_tests`: `proxy/extension/tests/proxy/ProbeFallbackTest.php`**

The test follows the existing `RequestProcessor`, real curl and `StubUpstreamServer` pattern, with one difference: it **loads the real `rules/probes.php`** instead of mirroring it.

- `proxy_tests` gets three read-only mounts: `proxy/dev_configuration`, `proxy/prod_configuration` and `standalone/vault/tent/configuration`. A data provider runs every case against each tree's `probes.php`. That enforces "standalone diverging from prod is a bug" and catches any change to the `connect_timeout: 1` / `timeout: 2` actually shipped.
- The test sets `$backendHost` (pointed at the stub, or at a free port with nothing listening) and then `require`s the file. **Constraint:** `probes.php` reads no other global than `$backendHost`, so it stays loadable on its own (no `locals.php`, no other rules).
- A new router, `support/upstream/probe_router.php`, picks its behaviour from the request: `200` with the marker, `503`, `404`, `500`, or `sleep(4)`.
- Cases:
  - **Unreachable** (free port): `GET` on both probes gives `502` and the pinned body.
  - **Hanging** (router sleeps 4s): `504` and the pinned body, and the call returns in **under 3s**. This locks in the "probe `timeout` below diagnose's `--max-time`" invariant on every Tent upgrade.
  - **Passthrough**: `200`, `503`, `404` and `500` from the stub reach the client unchanged.
  - **Matching**: `HEAD` (backend unreachable) gives `502` with the rewritten headers. `?x=1` matches. `POST /health.json` and `/HEALTH.json` don't hit the probe rule.
- The existing `BackendSetCookieForwardingTest` and `ClientIpForwardingTest` keep mirroring `backend.php`. Moving them to the real files is #619.

**3. Client: `standalone/test/diagnose.bats`**

- A `502` with `{"app":"kerghan","status":"down"}` is already covered ("a 502 with app kerghan: backend down, exit 4"). Add the `504` twin with the exact pinned body (`kerghan_down`, exit 4), which pins the contract between the proxy body and the client.

**Not automated:** a live backend-down check in `standalone/scripts/smoke_test.sh` (slow, needs `docker exec` into the privileged vault, and layer 2 already uses real Tent and curl against the real rule files). Instead, the PR description records a manual check: `docker-compose stop kerghan_app`, then `curl -i localhost:3000/health.json` and `curl -i localhost:3000/ready.json`.

### Documentation

- `docs/agents/architecture/backend/request-pipeline.md` (and/or the proxy architecture doc): the probe rule, its position before `backend.php`, and the synthesized bodies.
- `docs/agents/architecture/caching.md`: the probes are `no-store` at the proxy.
- `docs/agents/architecture/backend/request-pipeline.md` and `client-diagnose.md` also list the proxy-only values `status: "down"` and `checks.*: "unknown"`, next to the backend's own `ok | degraded | error` and `up | down`.
- `docs/agents/standalone/client-diagnose.md`: the backend-down case now carries the marker, and the invariant that the probe rule's Tent `timeout` (2s) stays below `probe_http`'s `--max-time` (3s).

## Benefits

- `kerghan diagnose` identifies a Kerghan instance whose backend is down or hung (exit 4, "backend down") instead of misreporting it as a foreign service or a silent timeout.
- Health checkers never see a false `200` from the probes while the backend is down.
- A hung backend holds an Apache worker for at most about 2s per probe instead of indefinitely.
