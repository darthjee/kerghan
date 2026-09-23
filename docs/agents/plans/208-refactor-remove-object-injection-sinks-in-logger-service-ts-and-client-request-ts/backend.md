# Backend Plan: Refactor: Remove object-injection sinks in logger.service.ts and client-request.ts

Main plan: [plan.md](plan.md)

## Overview
Two files use computed-key indexing that Codacy's `security/detect-object-injection` rule (High) flags: `LoggerService`'s console dispatch and level-rank comparison in `backend/src/core/logger.service.ts`, and the trusted-hop lookup in `backend/src/core/client-request.ts`. Replace each with a lookup shape that doesn't index by a dynamic key, with no behavior change (same log output, same level filtering, same trusted-hop IP selection including the empty-header fallback).

## Context
- `backend/src/core/logger.service.ts:135` and `:140` — `console[level](message)` / `console[level](message, effective)`, `level: LogLevel` (`'debug' | 'info' | 'warn' | 'error'`).
- `backend/src/core/logger.service.ts:170` — `LEVEL_RANK[level] >= LEVEL_RANK[this.threshold]`, where `LEVEL_RANK` is a `Record<LogLevel, number>` module-level constant.
- `backend/src/core/client-request.ts:61` — `hops[trustedIndex]`, where `trustedIndex = Math.max(0, hops.length - trustedProxyHops)` (already clamped to `>= 0` and, since `hops.length > 0` is checked just above, always a valid index into `hops`).
- The prior `mail.service.ts` object-injection fix (issue #207, commit `f1673e6`) established this repo's convention for this class of fix: swap a `Record<string, T>`/dynamic-key lookup for a `Map<string, T>` (`.get(...)`), keeping a private module-level `Map` where a `Record` constant existed before. Follow the same shape here for `LEVEL_RANK`.
- Function complexity must stay at or under 10 (ESLint-enforced) — neither change should need a complexity suppression.
- Existing specs already cover the current behavior for both files and must keep passing unmodified in intent (they exercise console output per level, level filtering, and IP/hop resolution): `backend/src/core/tests/logger.service.spec.ts`, `backend/src/core/tests/client-request.spec.ts`.

## Implementation Steps

### Step 1 — Table-drive the logger's level dispatch and rank comparison
In `backend/src/core/logger.service.ts`:
- Replace the `LEVEL_RANK: Record<LogLevel, number>` constant with a `LEVEL_RANK: Map<LogLevel, number>` (e.g. `new Map<LogLevel, number>([['debug', 0], ['info', 1], ['warn', 2], ['error', 3]])`), and update `shouldLog` to compare via `.get(level)`/`.get(this.threshold)` instead of bracket access — add a small private helper (e.g. `rank(level: LogLevel): number`) if that keeps `shouldLog` readable, since both sides read from the same map.
- Replace the two `console[level](...)` calls in `write()` with a dispatch that doesn't index `console` by a computed key — either a `switch (level) { case 'debug': console.debug(...); ... }`, or a `Map<LogLevel, (...args: unknown[]) => void>` built once (e.g. as a private static field) mapping each level to its bound `console` method (`console.debug.bind(console)` etc.) and invoked via `.get(level)!(...)`. Prefer whichever keeps `write()`'s two call sites (message-only vs. message+attributes) and its existing `// eslint-disable-next-line no-console` comments intact with the least duplication — a `switch` is likely simplest given there are only two call shapes, not one-console-call-per-level.
- Remove the now-unnecessary `// eslint-disable-next-line no-console` comments only if the replacement no longer triggers `no-console` at those lines (a `switch`/`Map` dispatch still calls `console.debug`/`console.info`/`console.warn`/`console.error` directly, which still trips `no-console` — keep the disable comments, just move them to wherever the direct `console.<level>(...)` calls end up).
- Keep `shouldLog`'s and `write`'s existing signatures, JSDoc, and the rest of the class untouched.

### Step 2 — Use bounds-safe indexing for the trusted proxy hop
In `backend/src/core/client-request.ts`, replace `return hops[trustedIndex];` with `return hops.at(trustedIndex)!;` (or, if the team prefers avoiding the non-null assertion, `hops.at(trustedIndex) ?? fallback ?? ''` — but note `fallback` is out of scope inside `extractIp`'s post-hops-check branch and the value is provably defined at this point, so a plain `.at(trustedIndex)!` with a short comment noting `trustedIndex` is always within `[0, hops.length)` here is the simplest faithful change). Do not change `extractClientRequestInfo`, the `hops.length === 0` early return, or how `trustedIndex` is computed.

## Files to Change
- `backend/src/core/logger.service.ts` — replace `LEVEL_RANK` bracket lookups and `console[level](...)` dispatch with `Map`/`switch`-based non-dynamic-key equivalents (Step 1).
- `backend/src/core/client-request.ts` — replace `hops[trustedIndex]` with `hops.at(trustedIndex)` (Step 2).

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- No spec changes are expected — both changes are internal refactors of already-covered code paths — but run the two files' existing specs to confirm no regression, since `write()`'s console dispatch and `shouldLog`'s comparison are exercised indirectly by every `LoggerService` spec, not just dedicated ones.
- Verify coverage doesn't drop: if a `switch`/`Map` dispatch introduces a branch existing specs don't hit for every level (e.g. only `debug`/`info` exercised at some log levels), check `logger.service.spec.ts`'s "NestJS LoggerService interface methods" and "level filtering" `describe` blocks already exercise all four levels before assuming no new spec is needed.
