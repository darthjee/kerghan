# Issue: Refactor: extract shared numeric-config getter helper for abuse-guard services

## Description
The two abuse-guard services each hand-roll numeric config getters with the same shape, differing only in the env-var key and default.

## Problem
`src/auth/account-edit-abuse-guard.service.ts` (`#maxAttempts`, `#lockMs`) and `src/auth/authorization-request-abuse-guard.service.ts` (`#createLimit`, `#createWindowMs`, `#maxOpenPerUser`, `#authorizeMaxAttempts`, `#authorizeLockMs`) together declare six private getters, every one following the same pattern:

```ts
Number(this.configService.get('SOME_KEY') ?? DEFAULT)
```

This boilerplate grows 1:1 with every new tunable added to either guard, and offers no shared place to fix a bug in how config values are parsed (e.g. NaN handling).

## Expected Behavior
Both guard services read their numeric config values through one shared utility instead of duplicating the `Number(... ?? default)` pattern six times. For every existing env var currently set to a valid number, the resolved value is unchanged; unlike today, a config value that fails to parse to a valid number (e.g. non-numeric garbage) falls back to the provided default instead of propagating `NaN`.

## Solution
Add a shared `getNumberConfig(configService: ConfigService, key: string, fallback: number): number` helper in a new `backend/src/core/numeric-config.ts` file. It reads the config value, parses it with `Number(...)`, and returns `fallback` whenever the value is missing or the parse result is `NaN`. Both guard services call this helper in place of their six hand-rolled private getters; each service keeps its own `DEFAULT_*` constants and env-var keys unchanged.

## Benefits
Cuts six near-identical getter methods down to one shared, testable utility; centralizes NaN-safe parsing so a malformed numeric env var no longer silently produces `NaN` in either guard; and gives future guards/services a ready-made way to read numeric config safely.
