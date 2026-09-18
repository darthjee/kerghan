# Refactor AccountEditAbuseGuardService

Replace the private `#nextAttemptState` method in
`src/auth/account-edit-abuse-guard.service.ts` with a call to the new `computeLockoutState`
helper from step 01, passing `this.#maxAttempts()` and `this.#lockMs()` (both already resolved
via `getNumberConfig`, unchanged) as the second/third arguments:

```ts
#nextAttemptState(currentAttempts: number): { attempts: number; lockedUntil: Date | null } {
  return computeLockoutState(currentAttempts, this.#maxAttempts(), this.#lockMs());
}
```

Import `computeLockoutState` from `../core/lockout-state.js`. `#applyFailure` and
`#insertFirstFailure`, which call `#nextAttemptState`, stay unchanged — this is a pure
implementation swap inside the private method, not a call-site change.

The existing behavioral spec (`src/auth/tests/account-edit-abuse-guard.service.spec.ts`) must
keep passing unchanged, since output values are identical — do not edit its assertions.

## Files to Change
- `src/auth/account-edit-abuse-guard.service.ts` — `#nextAttemptState` delegates to
  `computeLockoutState` instead of inlining the arithmetic.
