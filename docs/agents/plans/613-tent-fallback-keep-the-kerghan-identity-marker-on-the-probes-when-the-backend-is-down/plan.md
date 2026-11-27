# Plan: Tent fallback: keep the Kerghan identity marker on the probes when the backend is down

Issue: [613-tent-fallback-keep-the-kerghan-identity-marker-on-the-probes-when-the-backend-is-down.md](../../issues/613-tent-fallback-keep-the-kerghan-identity-marker-on-the-probes-when-the-backend-is-down.md)

## Overview

Add a dedicated Tent rule, `rules/probes.php`, loaded between `frontend.php` and `backend.php` in all three configuration trees. It proxies `GET`/`HEAD` on `/health.json` and `/ready.json` to the backend with its own short timeouts (1s connect, 2s total) and no cache. A new `ProbeFallbackMiddleware` rewrites Tent's empty `502`/`504` into a fixed `app: "kerghan"`, `status: "down"` body (`no-store`, upstream headers dropped). `kerghan diagnose` then reports "Kerghan, backend down" (exit 4) when the backend is unreachable or hung. The change is covered by a unit test, an end-to-end test that loads the **real** `probes.php` from all three trees, and a `diagnose.bats` case for `504`.

**Blocked:** do not start until #617 is merged and the root `version` file has `tent=` `>= 1.4.0` (the first Tent release with darthjee/tent#315). On `1.3.0` Tent answers an empty `200`, so the middleware never sees a `502`/`504` and the end-to-end test fails.

## Agents involved

- [proxy](proxy.md): middleware, dev and prod `probes.php`, unit and end-to-end tests, proxy docs.
- [standalone](standalone.md): standalone `probes.php`, `diagnose.bats` `504` case, the invariant comment in `standalone/bin/kerghan`, `client-diagnose.md`.
- [infra](infra.md): config-tree mounts for `proxy_tests` in `docker-compose.yml`, plus `KERGHAN_REPO_ROOT` in the CircleCI `proxy_extension_tests` job.

## Shared contracts

### 1. `Tent\Middlewares\ProbeFallbackMiddleware` (proxy produces; every `probes.php` consumes)

- File: `proxy/extension/lib/middlewares/ProbeFallbackMiddleware.php`, required from `proxy/extension/loader.php` next to the other middlewares. It ships to standalone through the Dockerfile's existing `COPY proxy/extension/lib/` line, so no Dockerfile change is needed.
- Config entry: `['class' => 'Tent\\Middlewares\\ProbeFallbackMiddleware']`, with no attributes. `build(array $attributes)` ignores them.
- `processResponse(Response $response)`: when `$response->httpCode()` is `502` or `504` **and** `$response->request()->requestPath()` is a probe path, it keeps the status, sets the body to the pinned string for that path, and replaces **all** headers with exactly:
  - `Content-Type: application/json`
  - `Cache-Control: no-store`
  - `Content-Length: <strlen(body)>`

  Anything else (other statuses, other paths) is returned unchanged.
- Pinned bodies (exact bytes, no whitespace, no trailing newline):
  - `/health.json`: `{"app":"kerghan","status":"down"}`
  - `/ready.json`: `{"app":"kerghan","status":"down","checks":{"database":"unknown","workers":"unknown"}}`
- The body is never built from request input (URI, query or headers), and the middleware logs nothing.

### 2. `rules/probes.php` (proxy writes dev and prod; standalone writes the standalone copy)

The three files are **byte-identical**: `proxy/dev_configuration/rules/probes.php`, `proxy/prod_configuration/rules/probes.php` and `standalone/vault/tent/configuration/rules/probes.php`. The end-to-end test asserts this. Shape:

```php
Configuration::buildRule([
    'handler' => [
        'type' => 'default_proxy',
        'host' => $backendHost,
        'cache' => false,          // default_proxy caches 2xx in ./cache by default
        'connect_timeout' => 1,
        'timeout' => 2             // must stay < diagnose's probe_http --max-time (3)
    ],
    'matchers' => [
        ['method' => 'GET',  'uri' => '/health.json', 'type' => 'exact'],
        ['method' => 'HEAD', 'uri' => '/health.json', 'type' => 'exact'],
        ['method' => 'GET',  'uri' => '/ready.json',  'type' => 'exact'],
        ['method' => 'HEAD', 'uri' => '/ready.json',  'type' => 'exact']
    ],
    'prependMiddlewares' => [
        ['class' => 'Tent\\Middlewares\\CanonicalHostHeaderMiddleware']
    ],
    'middlewares' => [
        ['class' => 'Tent\\Middlewares\\SetClientIpMiddleware'],
        ['class' => 'Tent\\Middlewares\\ProbeFallbackMiddleware']
    ]
]);
```

- The file reads **no global other than `$backendHost`**, so a test can set it and `require` the file on its own.
- Each tree's `configure.php` requires it between `rules/frontend.php` and `rules/backend.php`.
- The docblock says: the three copies must stay byte-identical; there are no cache middlewares and `cache => false` because probes are never cached; and the `timeout` < `--max-time` invariant, naming `standalone/bin/kerghan`'s `probe_http`.

### 3. Config-tree location for `proxy_tests` (infra provides; the proxy end-to-end test consumes)

- Env var `KERGHAN_REPO_ROOT`, default `/kerghan` when unset. The test reads:
  - `$KERGHAN_REPO_ROOT/proxy/dev_configuration/rules/probes.php`
  - `$KERGHAN_REPO_ROOT/proxy/prod_configuration/rules/probes.php`
  - `$KERGHAN_REPO_ROOT/standalone/vault/tent/configuration/rules/probes.php`
- docker-compose `proxy_tests` mounts the three directories read-only at those paths under `/kerghan` and leaves the env var unset. CircleCI `proxy_extension_tests` sets `KERGHAN_REPO_ROOT=/tmp/checkout`, where the job already checks the repo out.
- A missing file **fails** the test; it is never skipped.

### 4. Timeout invariant (proxy and standalone)

The probe rule's `timeout` (2) stays strictly below `probe_http`'s `--max-time` (3) in `standalone/bin/kerghan`. Each side carries a comment pointing at the other. The end-to-end hanging case asserts a `504` in under 3s.

## Notes

- Reviews on the PR: **security** (it touches Tent rules and response headers) and **cache** (confirm the probe rule has no cache middleware and sets `cache => false`).
- Out of scope: the Tent bump and API-rule timeouts (#617), the frontend 502/504 message (#618), and moving the existing proxy end-to-end tests to the real `backend.php` (#619).
- The backend's probe types are not widened. `status: "down"` and `checks.*: "unknown"` are documented as values only the proxy emits.
- Manual check for the PR description: `docker-compose stop kerghan_app`, then `curl -i localhost:3000/health.json` and `curl -i localhost:3000/ready.json` (expect `502` and the pinned bodies). Also `curl -I` (HEAD) for the same status with no body.
