# Add computeLockoutState helper

Create the shared pure helper that both abuse-guard services will call instead of duplicating the
"attempts + lockedUntil" cool-off arithmetic. Mirror the style of the existing
`src/core/numeric-config.ts` (a plain exported function, JSDoc naming its consumers), since this
new file sits alongside it as the next `src/core/` pure helper shared by the same two services.

```ts
export function computeLockoutState(
  currentAttempts: number,
  maxAttempts: number,
  lockMs: number,
): { attempts: number; lockedUntil: Date | null } {
  const attempts = currentAttempts + 1;
  const lockedUntil = attempts >= maxAttempts ? new Date(Date.now() + lockMs) : null;

  return { attempts, lockedUntil };
}
```

Add a matching spec exercising the function directly (not through either service), covering: an
attempt below `maxAttempts` (no lock), an attempt that reaches `maxAttempts` exactly (locks,
`>=` tie-break), an attempt already past `maxAttempts` (still locks), and that `lockedUntil` lands
roughly `lockMs` in the future when it trips.

## Files to Change
- `src/core/lockout-state.ts` (new) — the `computeLockoutState` pure helper.
- `src/core/tests/lockout-state.spec.ts` (new) — direct unit tests for the helper, per this repo's
  `src/core/tests/<name>.spec.ts` convention (see `src/core/tests/numeric-config.spec.ts` for the
  sibling pattern).
