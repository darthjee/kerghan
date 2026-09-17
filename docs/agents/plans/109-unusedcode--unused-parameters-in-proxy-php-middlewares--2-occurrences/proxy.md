# Proxy Plan: UnusedCode: unused parameters in proxy PHP middlewares (2 occurrences)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Suppress the unused `$attributes` in `SetClientIpMiddleware::build()`
`SetClientIpMiddleware extends Middleware`, whose static factory contract is `build(array $attributes): self` — the same signature `CacheControlMiddleware::build()` overrides one file over, so the parameter cannot be dropped. `SetClientIpMiddleware` always constructs itself with no arguments (it only ever reads `$_SERVER['REMOTE_ADDR']` at call time via `$remoteAddrProvider`), so `$attributes` is genuinely unused. Suppress the PHPMD finding inline, following the same convention already used one method away in this file (`// @SuppressWarnings(PHPMD.Superglobals)` inside the constructor). Add `// @SuppressWarnings(PHPMD.UnusedFormalParameter)` directly above `public static function build(array $attributes): SetClientIpMiddleware`. No behavior change.

### Step 2 — Narrow `TestHeaderMiddleware::handle()` to drop the unused `$request`
`TestHeaderMiddleware` does not extend `Middleware` and is not wired into any rule in `dev_configuration`/`prod_configuration` — per `docs/agents/architecture/proxy.md` it exists purely as a "sample middleware demonstrating the extension pattern," so nothing in this repo enforces a two-parameter `handle()` signature. Change the signature to `handle(Response $response): void`, drop the now-unused `use Tent\Models\Request;` import and the `@param Request $request` docblock line, and update the call site in `TestHeaderMiddlewareTest::testAddsTestHeader()` to construct/pass only `$response` (drop the `$request` mock and its argument in the `$middleware->handle(...)` call).

## Files to Change
- `proxy/extension/lib/middlewares/SetClientIpMiddleware.php` — add `// @SuppressWarnings(PHPMD.UnusedFormalParameter)` above `build()`.
- `proxy/extension/lib/middlewares/TestHeaderMiddleware.php` — change `handle(Request $request, Response $response): void` to `handle(Response $response): void`, remove the `Request` import and its docblock `@param` line.
- `proxy/extension/tests/middlewares/TestHeaderMiddlewareTest.php` — remove the `$request` mock and update the `$middleware->handle(...)` call to pass only `$response`.

## CI Checks
- `proxy/extension`: `docker compose run --rm proxy_tests` (CI job: `proxy_extension_tests`)

## Notes
- No production behavior changes in either middleware — this is purely a signature/annotation cleanup to clear the two Codacy `UnusedFormalParameter` findings.
