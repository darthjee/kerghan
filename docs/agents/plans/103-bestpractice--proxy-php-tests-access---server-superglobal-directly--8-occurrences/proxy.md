# Proxy Plan: BestPractice: proxy PHP tests access $_SERVER superglobal directly (8 occurrences)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Inject a remote-address provider into SetClientIpMiddleware

Add a constructor to `SetClientIpMiddleware` that accepts an optional
`callable(): string` remote-address provider, defaulting to a closure that
reads `$_SERVER['REMOTE_ADDR'] ?? ''`. Mark that default-closure line with
`@SuppressWarnings(PHPMD.Superglobals)` since it's the one unavoidable
production read — `ProcessingRequest`/the `tent` library have no
PSR-7-style `getServerParams()` or built-in remote-address concept, and
`Middleware::build()` runs once at config-parse time, not per request, so
it can't carry a per-request value either.

`processRequest()` calls the injected provider (`($this->remoteAddrProvider)()`)
instead of reading `$_SERVER` inline. `build()` is unchanged — it keeps
constructing the middleware with no arguments, so the default provider is
used and production behavior (and the "not configurable via rule config"
doc comment) stays the same.

### Step 2 — Update SetClientIpMiddlewareTest to inject a fake provider

Replace every `$_SERVER['REMOTE_ADDR'] = '...'` write with constructing the
middleware via `new SetClientIpMiddleware(fn(): string => '203.0.113.7')`
(or the test's existing IP literal). Remove the `setUp`/`tearDown`
save-and-restore of `$this->originalRemoteAddr` entirely — it exists only
to protect against the superglobal mutation this change removes.

All 6 test methods that currently set `$_SERVER['REMOTE_ADDR']`
(`testAddsHeaderWhenAbsent`, `testReplacesSpoofedHeader`,
`testReplacesSpoofedHeaderRegardlessOfCase`,
`testOnlyForwardedForHeaderIsChanged`, `testBuildReturnsUsableInstance`)
switch to passing the fake provider into the constructor instead.
`testBuildReturnsUsableInstance` keeps calling `SetClientIpMiddleware::build([])`
(build stays argument-less) and only needs to assert the default provider
still works when a real `$_SERVER['REMOTE_ADDR']` is set (this is the one
remaining legitimate use of the superglobal in the test file, to exercise
the default path).

## Files to Change

- `proxy/extension/lib/middlewares/SetClientIpMiddleware.php` — add
  constructor + remote-address provider property, suppress PHPMD on the
  default closure, use the provider in `processRequest()`.
- `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php` —
  inject fake providers instead of mutating `$_SERVER`; drop
  `setUp`/`tearDown`.

## CI Checks

- `proxy/extension`: `docker-compose run proxy_tests` (CI job: `proxy_extension_tests`)

## Notes

- Scope is limited to `proxy/extension/` — no other file in the repo
  touches `$_SERVER`.
- This is a targeted decoupling, not a PSR-7 migration: the underlying
  `tent` library (external dependency, out of scope) has no PSR-7 request
  object to source server params from.
