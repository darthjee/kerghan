# Issue: Refactor: extract shared lockout-state computation from abuse-guard services

## Description
The two abuse-guard services independently compute the same "attempts + lockedUntil" cool-off arithmetic.

## Problem
`src/auth/account-edit-abuse-guard.service.ts` (`#nextAttemptState`) and `src/auth/authorization-request-abuse-guard.service.ts` (`registerAuthorizeFailure`) both compute:

```ts
attempts = current + 1;
lockedUntil = attempts >= maxAttempts ? new Date(Date.now() + lockMs) : null;
```

Both classes' doc comments already acknowledge this — one explicitly says it "mirrors" the other's cool-off logic — but the arithmetic itself is copy-pasted rather than shared, just wired to different persistence targets (a repository row vs. a passed-in entity).

The arithmetic is confirmed identical between the two call sites (same `>=` tie-break at `maxAttempts`, same `Date.now()` clock source, no rounding/timezone concerns). The only difference is where each service reads its "current" attempts value from: `AccountEditAbuseGuardService` passes it in explicitly (`0` for a new row, or the persisted `failedAttempts` for an existing one), while `AuthorizationRequestAbuseGuardService` reads it off the passed-in entity (`request.authorizeFailedAttempts`). Both services already resolve `maxAttempts`/`lockMs` independently via the shared `getNumberConfig` helper in `src/core/numeric-config.ts`, so a new pure helper doesn't need to take a `ConfigService` — just plain numbers.

## Expected Behavior
The lockout cool-off computation lives in exactly one place; both guard services (and any future abuse-guard) use it, with their own persistence logic layered on top. Resulting `attempts`/`lockedUntil` values are unchanged for existing behavior — the existing Jest specs for both services (`src/auth/tests/account-edit-abuse-guard.service.spec.ts` and `src/auth/tests/authorization-request-abuse-guard.service.spec.ts`), which already assert this arithmetic behaviorally, must continue to pass unchanged.

## Solution
Extract a shared pure helper into a new file, `src/core/lockout-state.ts`, alongside the existing `src/core/numeric-config.ts` (which already namechecks both services as consumers of `getNumberConfig`):

```ts
computeLockoutState(currentAttempts: number, maxAttempts: number, lockMs: number): { attempts: number; lockedUntil: Date | null }
```

Both `AccountEditAbuseGuardService` and `AuthorizationRequestAbuseGuardService` resolve their own `maxAttempts`/`lockMs` (as they already do today via `getNumberConfig`) and their own "current attempts" value, call the shared helper for the arithmetic, then layer their own persistence logic (repository row vs. passed-in entity) on top of the result. Add direct unit tests for `computeLockoutState` itself, since it's now a standalone pure function.

## Benefits
Guarantees the two guards' lockout math can't silently diverge, and gives a single, directly-unit-testable function for this security-relevant calculation instead of two comment-linked copies.
