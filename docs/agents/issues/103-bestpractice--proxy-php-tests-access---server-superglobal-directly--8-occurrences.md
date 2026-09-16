# Issue: BestPractice: proxy PHP tests access $_SERVER superglobal directly (8 occurrences)

## Codacy finding

- **Tool / pattern:** `rulesets-controversial.xml-Superglobals` (PHPMD)
- **Category:** BestPractice
- **Occurrences (8):**
  - `proxy/extension/lib/middlewares/SetClientIpMiddleware.php:67` (`processRequest`)
  - `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php:22` (`setUp`)
  - `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php:27` (`tearDown`)
  - `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php:48` (`testAddsHeaderWhenAbsent`)
  - `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php:67` (`testReplacesSpoofedHeader`)
  - `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php:88` (`testReplacesSpoofedHeaderRegardlessOfCase`)
  - `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php:106` (`testOnlyForwardedForHeaderIsChanged`)
  - `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php:129` (`testBuildReturnsUsableInstance`)

## Problem

`SetClientIpMiddleware::processRequest` reads `$_SERVER['REMOTE_ADDR']`
directly, coupling the middleware to global state. Its test file mutates
`$_SERVER['REMOTE_ADDR']` directly in `setUp`/`tearDown` and in every test
method to fake the remote address, which makes tests order-dependent on
correct cleanup and unable to run assertions against multiple simulated
clients in isolation.

Note: this middleware is part of Tent's custom PHP proxy extension
(`proxy/extension/`), not a PSR-7/Slim app — `ProcessingRequest` (defined in
the external `tent` library this proxy runs on) has no
`getServerParams()`/PSR-7 equivalent and no built-in concept of "remote
address." It is also the *only* place in the entire `proxy/` tree that
touches `$_SERVER`, and `Tent\Middlewares\Middleware::build()` is invoked
once at rule/config-parse time — not per request — so a build-time
attribute can't carry a per-request value like the remote IP either.

## Suggested fix

Inject the remote-address lookup instead of reading the superglobal inline:

- Add a constructor to `SetClientIpMiddleware` that accepts an optional
  `callable(): string` "remote address provider", defaulting to a closure
  that reads `$_SERVER['REMOTE_ADDR'] ?? ''` (this default closure is the
  single, isolated place in production code that still touches `$_SERVER`
  — unavoidable, since nothing else in the request pipeline surfaces the
  peer address). Mark that one line with
  `@SuppressWarnings(PHPMD.Superglobals)` so Codacy fully clears this
  finding instead of reporting one remaining, unavoidable occurrence.
- `processRequest()` calls the injected provider instead of reading
  `$_SERVER` inline.
- `build()` keeps using the default provider (production behavior is
  unchanged; the middleware stays unconfigurable via rule config, per its
  existing doc comment).
- Update all 8 test methods to construct
  `new SetClientIpMiddleware(fn(): string => '203.0.113.7')` (or similar)
  instead of mutating `$_SERVER['REMOTE_ADDR']`, and drop the
  `setUp`/`tearDown` save-and-restore dance entirely.

This is a targeted decoupling, not a PSR-7 migration — the codebase has no
PSR-7 request object to source server params from.

## Benefits

- Removes all 7 test-side superglobal mutations, eliminating the
  save/restore boilerplate and any risk of test order affecting global
  state.
- Isolates the one remaining, unavoidable `$_SERVER` read in production
  code to a single default closure, instead of it being inline in the
  method under test.
- Tests can express "the client connected from IP X" directly via the
  constructor, which is clearer than mutating a superglobal before
  building the request.
