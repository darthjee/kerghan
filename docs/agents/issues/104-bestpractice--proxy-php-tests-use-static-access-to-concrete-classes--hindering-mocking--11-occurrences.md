# Issue: BestPractice: proxy PHP tests use static access to concrete classes, hindering mocking (11 occurrences)

## Description
Codacy's PHPMD `rulesets-cleancode.xml-StaticAccess` rule flags 11 occurrences of tests calling methods statically on concrete classes instead of through an instance, across three proxy test files:

- `proxy/extension/tests/cache/DomainHashTest.php` (7 occurrences) — all calls to `DomainHash::hash()`
- `proxy/extension/tests/middlewares/CacheControlMiddlewareTest.php` (3 occurrences) — all calls to `CacheControlMiddleware::build()`
- `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php` (1 occurrence) — the call to `SetClientIpMiddleware::build()`

## Problem
Static access from tests to concrete classes normally couples tests tightly to implementations and prevents substituting test doubles, which can hide real design issues. However, investigating each occurrence here shows both static call sites are already justified, not accidental:

- `DomainHash::hash()` (`proxy/extension/lib/cache/DomainHash.php`) is documented as a "Standalone static helper": a pure, stateless function of its one argument (domain string in, SHA-256-prefixed folder name out), with no I/O and no collaborators to substitute. There is nothing to mock.
- `CacheControlMiddleware::build()` and `SetClientIpMiddleware::build()` are the static factory-method contract the Tent middleware framework itself dictates: Tent loads a middleware by class name from config and calls `<Class>::build($attributes)` on it (see each class's "Usage in configuration" docblock) before any instance exists. The `build()` tests exist specifically to exercise that static factory contract — there is no instance to inject a double into at that point.

## Expected Behavior
The Codacy `StaticAccess` finding is resolved without introducing indirection that has no behavioral purpose — e.g. wrapping `DomainHash::hash()` in a needless instance, or fighting the framework's own static `build()` contract.

## Solution
Per the finding's own guidance ("where a method is genuinely a pure, stateless utility, it's acceptable to keep it static"), suppress the rule at each justified call site with a brief inline rationale, following the precedent already set in this codebase for justified PHPMD findings (`// @SuppressWarnings(PHPMD.Superglobals)` in `SetClientIpMiddleware.php`, added for issue #99/#103):

- Add `// @SuppressWarnings(PHPMD.StaticAccess)` above the relevant test methods/lines in `DomainHashTest.php`, `CacheControlMiddlewareTest.php`, and `SetClientIpMiddlewareTest.php`, each with a one-line comment pointing to why the static call is intentional (pure utility function / framework-mandated static factory contract).
- No changes to the production classes (`DomainHash`, `CacheControlMiddleware`, `SetClientIpMiddleware`) — they should keep their current static methods as-is.

## Benefits
Closes the Codacy finding while keeping the tests simple and directly exercising the real, framework-mandated contracts, instead of adding object-construction ceremony around a pure function or working around a static factory contract the middleware framework itself requires.
