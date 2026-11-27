# Add ProbeFallbackMiddleware with unit tests

Create the response-side middleware that turns Tent's empty `502`/`504` on a probe path into the pinned `app: "kerghan"` body. Follow `CacheControlMiddleware` and `SetResponseHeadersMiddleware` (namespace `Tent\Middlewares`, `extends Middleware`, static `build(array $attributes)`, `processResponse(Response $response): Response`). The class docblock explains:

- why it exists: identity on the probes when the backend is down, for `kerghan diagnose` (#609, #613);
- why `SetResponseHeadersMiddleware` cannot do it: headers only, no body, can't drop upstream headers;
- why Tent's own `502` is not told apart from an upstream one: Tent adds no marker, and the backend never sends `502`/`504`;
- that `500` is deliberately not rewritten.

Behaviour, per plan.md contract 1:

- Map of probe path to pinned body as class constants: `/health.json` gives `{"app":"kerghan","status":"down"}`, and `/ready.json` gives `{"app":"kerghan","status":"down","checks":{"database":"unknown","workers":"unknown"}}`.
- Look up the path with `$response->request()->requestPath()`, which excludes the query string. If the status is not `502`/`504` or the path is not in the map, return `$response` untouched.
- On a match, call `setBody(<pinned>)` and `setHeaders(['Content-Type: application/json', 'Cache-Control: no-store', 'Content-Length: ' . strlen(<pinned>)])`. Keep the status code.

Unit tests (`ProbeFallbackMiddlewareTest`), with responses built in memory around a `Request` of the given path. Use `DomainHashTestRequest` or `Tent\Models\Request` with a `requestPath` option, as the existing middleware tests do.

- `502` and `504` on `/health.json` and on `/ready.json`: the exact pinned body, status kept, headers exactly the three lines, and a correct `Content-Length`.
- Upstream headers on the input (`Set-Cookie`, `Server`, `X-Powered-By`, `Content-Length: 0`) are all absent after a rewrite.
- `200`, `503` (with a body), `404` and `500` on a probe path come back unchanged (body and headers).
- `502` on a non-probe path (`/projects.json`) comes back unchanged.
- `/health.json?x=1&y=<script>` gives the same pinned body, with no request input echoed.
- `build([])` returns an instance.

## Files to Change

- `proxy/extension/lib/middlewares/ProbeFallbackMiddleware.php`: new.
- `proxy/extension/loader.php`: `require_once __DIR__ . '/lib/middlewares/ProbeFallbackMiddleware.php';` next to the other middleware requires.
- `proxy/extension/tests/middlewares/ProbeFallbackMiddlewareTest.php`: new.
