# Issue: UnusedCode: unused parameters in proxy PHP middlewares (2 occurrences)

## Description
Codacy (PHPMD, `rulesets-unusedcode.xml-UnusedFormalParameter`) flags two unused method parameters in the proxy extension's custom middlewares:

- `proxy/extension/lib/middlewares/SetClientIpMiddleware.php:53` — `build(array $attributes)` never uses $attributes.
- `proxy/extension/lib/middlewares/TestHeaderMiddleware.php:23` — `handle(Request $request, Response $response)` never uses $request.

## Problem
The two occurrences have different underlying causes, so they need different fixes:

1. **`SetClientIpMiddleware::build()`** extends Tent's own `Middleware` base class, which (per `CacheControlMiddleware::build(array $attributes)`, the sibling middleware in the same directory) imposes a fixed `build(array $attributes): self` static-factory signature. $attributes genuinely isn't needed here (this middleware always uses the current request's `REMOTE_ADDR`, per its own docblock), but the parameter can't be dropped without breaking the inherited contract.
2. **`TestHeaderMiddleware::handle()`** does not extend any base class and is not wired into any rule (`dev_configuration`/`prod_configuration`) — per `docs/agents/architecture/proxy.md`, it exists purely as a "sample middleware demonstrating the extension pattern." Its $request parameter is unused, and unlike `SetClientIpMiddleware`, nothing in this repo enforces that its `handle()` signature must keep both parameters.

## Solution
- **`SetClientIpMiddleware::build()`**: keep the $attributes parameter (required by the inherited `Middleware::build()` contract) and suppress the PHPMD finding inline, following the same convention already used one method away in this file (`// @SuppressWarnings(PHPMD.Superglobals)` in the constructor) — add `// @SuppressWarnings(PHPMD.UnusedFormalParameter)` above `build()`.
- **`TestHeaderMiddleware::handle()`**: narrow the signature by removing the unused $request parameter — `handle(Response $response): void` — and update `TestHeaderMiddlewareTest` and the method's docblock (drop the `@param Request $request` line) to match.

## Benefits
- Clears both Codacy findings without weakening either middleware's external contract.
- `SetClientIpMiddleware` keeps honoring Tent's `Middleware::build()` contract via a documented, deliberate suppression, consistent with this file's existing suppression style.
- `TestHeaderMiddleware`'s sample signature shrinks to only what it actually uses, which is simpler and accurate for a demonstration file with no real caller.
