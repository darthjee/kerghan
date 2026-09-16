# Proxy Plan: BestPractice: proxy PHP tests use static access to concrete classes, hindering mocking (11 occurrences)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Suppress the justified `PHPMD.StaticAccess` occurrences

Add a `// @SuppressWarnings(PHPMD.StaticAccess)` annotation immediately above each flagged static call (or above the test method, when a single method contains multiple flagged calls, per PHPMD's usual doc-comment scoping), each paired with a short inline comment explaining why the static call is intentional. This follows the same suppression pattern already used in this codebase for a justified PHPMD finding: `// @SuppressWarnings(PHPMD.Superglobals)` in `proxy/extension/lib/middlewares/SetClientIpMiddleware.php` (added for issue #99/#103).

Do not change `DomainHash`, `CacheControlMiddleware`, or `SetClientIpMiddleware` themselves, and do not change any test's assertions or behavior — this is an annotation-only change.

Rationale to note in each comment:
- `DomainHash::hash()` calls: pure, stateless static helper (no I/O, no collaborators to substitute — see the class's own docblock).
- `CacheControlMiddleware::build()` / `SetClientIpMiddleware::build()` calls: static factory contract mandated by the Tent middleware framework (it instantiates a configured middleware by calling `<Class>::build($attributes)` on the class name from config, before any instance exists — see each class's "Usage in configuration" docblock); the test exists specifically to exercise that static contract.

## Files to Change
- `proxy/extension/tests/cache/DomainHashTest.php` — suppress `PHPMD.StaticAccess` at the 7 `DomainHash::hash()` call sites (lines 37, 47, 48, 59, 60, 73, 74 as of the Codacy finding).
- `proxy/extension/tests/middlewares/CacheControlMiddlewareTest.php` — suppress `PHPMD.StaticAccess` at the 3 `CacheControlMiddleware::build()` call sites (lines 88, 101, 114 as of the Codacy finding).
- `proxy/extension/tests/middlewares/SetClientIpMiddlewareTest.php` — suppress `PHPMD.StaticAccess` at the 1 `SetClientIpMiddleware::build()` call site (line 132 as of the Codacy finding — the `testBuildReturnsUsableInstance` test).

## CI Checks
- `proxy/extension`: `docker-compose run proxy_tests` (CI job: `proxy_extension_tests`) — confirms the annotation-only change doesn't break the existing suite. Note this job runs `phpunit`, not PHPMD/Codacy directly; the `StaticAccess` finding itself only clears on Codacy's next analysis of the pushed branch.

## Notes
- Line numbers above are copied from the Codacy finding at the time this issue was filed and may drift slightly if the files change before this plan is implemented — match by call site (`DomainHash::hash(`, `CacheControlMiddleware::build(`, `SetClientIpMiddleware::build(`), not by exact line number.
- No production code changes are in scope for this issue.
