# Row-3 regression test: client IP through the full chain

Add `proxy/extension/tests/proxy/ClientIpForwardingTest.php`, modelled on `BackendSetCookieForwardingTest`: build the backend `*.json` rule (mirroring `proxy/dev_configuration/rules/backend.php`, including `SetClientIpMiddleware`), send a request carrying a client-supplied `X-Forwarded-For: 203.0.113.9, 198.51.100.7` through `RequestProcessor` and the `default_proxy` handler over real curl to a `StubUpstreamServer`, and assert the upstream received exactly one `X-Forwarded-For` value equal to the request's `REMOTE_ADDR`. A new upstream router under `tests/support/upstream/` echoes the received request headers (as JSON) so the test can assert on them.

This guards the standalone automatic-login IP allowlist (`KERGHAN_TRUSTED_PROXY_HOPS=1`) against Tent appending its own `X-Forwarded-For` entry after the middleware, or changing middleware ordering, on any future bump. `SetClientIpMiddlewareTest` keeps covering the middleware in isolation.

## Files to Change

- `proxy/extension/tests/proxy/ClientIpForwardingTest.php` — new.
- `proxy/extension/tests/support/upstream/echo_headers_router.php` — new stub upstream router.
