# Issue: Refactor: Address PHPMD StaticAccess warnings in CacheControlMiddlewareTest and DomainHashTest

## Description
Two proxy tests call public static APIs under test and trigger PHPMD's `StaticAccess` rule. Suppressions already exist at every flagged line, but they are written as inline `//` comments, which PHPMD ignores — PHPMD only honours `@SuppressWarnings` inside a class or method **docblock**.

## Problem
`rulesets-cleancode.xml-StaticAccess` (Warning), 4 findings:

- `proxy/extension/tests/middlewares/CacheControlMiddlewareTest.php:92`, `:109`, `:126` (`CacheControlMiddleware::build(...)` in `testBuildUsesMaxAgeSecondsAttribute`, `testBuildUsesSnakeCaseMaxAgeSecondsAttribute`, `testBuildDefaultsToZeroMaxAge`)
- `proxy/extension/tests/cache/DomainHashTest.php:40` (`DomainHash::hash(...)` in `testHashMatchesExpectedFormat`)

In each case the method body contains a `// @SuppressWarnings(PHPMD.StaticAccess) ...` line comment right above the call. The other `DomainHashTest` methods, which put the same annotation in the method docblock, are **not** flagged — confirming the placement is the root cause.

## Expected Behavior
- The 4 findings disappear from PHPMD/Codacy.
- Tests are unchanged in behaviour and coverage.
- No inline `// @SuppressWarnings` comments remain in `proxy/extension`.

## Solution
Test-only change; production code (`CacheControlMiddleware::build()`, `DomainHash::hash()`) stays static, since these are the public static contracts under test (Tent's middleware factory contract and a pure stateless helper).

- For each of the 4 affected test methods, move the existing `@SuppressWarnings(PHPMD.StaticAccess)` annotation and its one-line reason from the inline `//` comment into the method's docblock, matching the style already used by the other `DomainHashTest` methods and by `SetClientIpMiddlewareTest` (#232).
- Remove the inline `//` suppression comments.
- Keep suppressions per-method (not class-level), consistent with existing convention.

## Benefits
Removes 4 Warning findings, documents that static access in these tests is deliberate, and fixes suppressions that looked effective but were silently ignored.

## Verification

- `docker-compose run --rm proxy_tests` passes.
- `grep -rn '// @SuppressWarnings' proxy/extension` returns nothing.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.
