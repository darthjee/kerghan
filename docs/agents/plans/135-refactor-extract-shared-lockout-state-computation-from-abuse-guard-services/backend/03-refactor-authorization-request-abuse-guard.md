# Refactor AuthorizationRequestAbuseGuardService

`registerAuthorizeFailure` in `src/auth/authorization-request-abuse-guard.service.ts` inlines the
same arithmetic (no private helper method to replace, unlike the account-edit guard — the
computation is directly in the method body). Replace it with a call to `computeLockoutState` from
step 01:

```ts
async registerAuthorizeFailure(request: AuthorizationRequest): Promise<void> {
  const { attempts, lockedUntil } = computeLockoutState(
    request.authorizeFailedAttempts,
    this.#authorizeMaxAttempts(),
    this.#authorizeLockMs(),
  );

  await this.authorizationRequestRepository.update(request.id, {
    authorizeFailedAttempts: attempts,
    authorizeLockedUntil: lockedUntil,
  });
}
```

Import `computeLockoutState` from `../core/lockout-state.js`. `#authorizeMaxAttempts()` and
`#authorizeLockMs()` stay unchanged.

The existing behavioral spec
(`src/auth/tests/authorization-request-abuse-guard.service.spec.ts`) must keep passing
unchanged, since output values are identical — do not edit its assertions.

## Files to Change
- `src/auth/authorization-request-abuse-guard.service.ts` — `registerAuthorizeFailure` delegates
  to `computeLockoutState` instead of inlining the arithmetic.
