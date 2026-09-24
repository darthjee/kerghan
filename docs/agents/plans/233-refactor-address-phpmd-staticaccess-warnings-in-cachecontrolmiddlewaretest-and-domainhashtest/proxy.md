# Proxy Plan: Refactor: Address PHPMD StaticAccess warnings in CacheControlMiddlewareTest and DomainHashTest

Main plan: [plan.md](plan.md)

## Overview
PHPMD only honours `@SuppressWarnings` inside a class or method docblock. Four test methods carry the right suppression, but as an inline `//` comment in the method body, so PHPMD still reports `StaticAccess`. Moving each annotation (and its one-line reason) into the method docblock fixes the findings without touching production code.

## Context
- `CacheControlMiddleware::build()` is Tent's static middleware factory contract; `DomainHash::hash()` is a pure stateless helper. Both are the static APIs under test, so they stay static.
- Established convention (see `DomainHashTest::testSameDomainHashesIdentically` and `SetClientIpMiddlewareTest` from #232): per-method docblock suppression with an indented reason, e.g.

  ```php
  /**
   * The same domain always hashes identically.
   *
   * @SuppressWarnings(PHPMD.StaticAccess) DomainHash::hash() is a pure,
   *     stateless static helper (no I/O, no collaborators to substitute —
   *     see the class's own docblock).
   */
  ```

## Implementation Steps

### Step 1 — Move CacheControlMiddlewareTest suppressions into docblocks
In `testBuildUsesMaxAgeSecondsAttribute`, `testBuildUsesSnakeCaseMaxAgeSecondsAttribute` and `testBuildDefaultsToZeroMaxAge`:
- Add to each method's existing docblock (after the summary line and a blank ` *` line) `@SuppressWarnings(PHPMD.StaticAccess)` followed by the existing reason ("CacheControlMiddleware::build() is the static factory contract mandated by the Tent middleware framework (see the class's own "Usage in configuration" docblock); this test exists specifically to exercise that static contract."), wrapped with the 5-space continuation indent used elsewhere.
- Delete the four-line inline `// @SuppressWarnings...` comment block from each method body.

### Step 2 — Move DomainHashTest suppression into docblock
In `testHashMatchesExpectedFormat`:
- Add the same `@SuppressWarnings(PHPMD.StaticAccess) DomainHash::hash() is a pure, stateless static helper ...` block used by the sibling methods to its docblock.
- Delete the inline `// @SuppressWarnings...` comment (and the blank line it leaves, if any) from the body.

## Files to Change
- `proxy/extension/tests/middlewares/CacheControlMiddlewareTest.php` — move 3 inline suppressions into method docblocks.
- `proxy/extension/tests/cache/DomainHashTest.php` — move 1 inline suppression into the method docblock.

## CI Checks
- `proxy/extension`: `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`)
- `grep -rn '// @SuppressWarnings' proxy/extension` must return nothing.

## Notes
- No behavioural or coverage change; assertions and test bodies otherwise stay identical.
- Keep suppressions per-method, not class-level.
- Final confirmation of the removed findings comes from Codacy's re-analysis of `main` after merge (Codacy MCP is not required locally).
