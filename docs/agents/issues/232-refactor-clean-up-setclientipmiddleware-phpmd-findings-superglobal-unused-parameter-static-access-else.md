# Issue: Refactor: Clean up SetClientIpMiddleware PHPMD findings (superglobal, unused parameter, static access, else)

## Description
`SetClientIpMiddleware` and its test trigger five PHPMD findings on Codacy, even though both files already *try* to suppress several of them.

## Problem
- `proxy/extension/lib/middlewares/SetClientIpMiddleware.php:54` — `Superglobals` (Warning): the constructor's default provider closure reads `$_SERVER['REMOTE_ADDR']`
- `proxy/extension/lib/middlewares/SetClientIpMiddleware.php:72` — `UnusedFormalParameter` (Warning): `build(array $attributes)` never uses `$attributes`
- `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php:108` — `Superglobals` (Warning) in `testBuildReturnsUsableInstance`
- `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php:119` — `StaticAccess` (Warning) on `SetClientIpMiddleware::build`
- `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php:128` — `ElseExpression` (Info) in the `finally` block restoring `REMOTE_ADDR`

Root cause of why the existing suppressions don't work: they are written as `// @SuppressWarnings(...)` line comments. PHPMD only honours `@SuppressWarnings` inside a `/** ... */` docblock attached to a class, method, function or property — line comments are ignored.

Constraints:
- `build(array $attributes)` is the static factory contract mandated by Tent's `Middleware` base class, so the parameter cannot be dropped.
- `testBuildReturnsUsableInstance` is the only test exercising the real `$_SERVER['REMOTE_ADDR']` default, so it must keep doing so.

## Expected Behavior
Client-IP detection behaves identically: `X-Forwarded-For` is still unconditionally replaced (case-insensitively) with Tent's view of `REMOTE_ADDR`, read lazily at request-processing time. The five findings disappear from Codacy.

## Solution
Production (`SetClientIpMiddleware.php`):
- Move the default `$_SERVER['REMOTE_ADDR']` provider out of the constructor and into `build()`, so the constructor never touches a superglobal (it just stores the injected provider callable). `build()` passes `new self(static fn(): string => (string) ($_SERVER['REMOTE_ADDR'] ?? ''))`, keeping the read lazy.
- Put both `@SuppressWarnings(PHPMD.Superglobals)` and `@SuppressWarnings(PHPMD.UnusedFormalParameter)` in `build()`'s docblock, with a short justification (Tent entry point / base-class contract). Remove the ineffective `//` suppression comments.

Test (`SetClientIpMiddlewareTest.php`):
- Move `@SuppressWarnings(PHPMD.Superglobals)` and `@SuppressWarnings(PHPMD.StaticAccess)` into `testBuildReturnsUsableInstance`'s docblock and drop the inline `//` comment.
- Remove the `else` by snapshotting the whole `$_SERVER` array before the test and restoring it wholesale in `finally` (`$_SERVER = $originalServer;`).

Out of scope: the `//`-style suppressions in `CacheControlMiddlewareTest` and `DomainHashTest` are handled by #233.

## Verification
- `docker-compose run --rm proxy_tests` passes.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

## Benefits
Removes 5 findings, confines superglobal access to the single Tent factory entry point, and fixes a suppression style that silently never worked.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
