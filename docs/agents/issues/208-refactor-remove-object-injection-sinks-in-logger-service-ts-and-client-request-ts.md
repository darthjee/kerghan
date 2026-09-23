# Issue: Refactor: Remove object-injection sinks in logger.service.ts and client-request.ts

## Description
The logger and the client-IP resolver index objects/arrays with computed keys.

## Problem
`security/detect-object-injection` (High) at:

- `backend/src/core/logger.service.ts:135` and `:140` (`console[level](...)`) and `:170` (`LEVEL_RANK[level] >= LEVEL_RANK[this.threshold]`)
- `backend/src/core/client-request.ts:61` (`hops[trustedIndex]`)

## Expected Behavior
Log output, level filtering and trusted-proxy hop selection behave exactly as before, including the fallback when the header is empty.

## Solution
In the logger, replace the console dispatch with a `switch`/small `Map<LogLevel, (…args) => void>` and the rank comparison with a `Map` (or a `rank(level)` helper). In `client-request.ts`, use `hops.at(trustedIndex)` (already bounds-checked by the surrounding `Math.max`) instead of bracket access. Keep function complexity at or under 10 (ESLint-enforced).

## Benefits
Removes four High findings without changing behaviour, and makes the logger's level handling table-driven and typed.

## Verification

- `docker-compose run --rm kerghan_tests yarn lint` and `docker-compose run --rm kerghan_tests yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).

