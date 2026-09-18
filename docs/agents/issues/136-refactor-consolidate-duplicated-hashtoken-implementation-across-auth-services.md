# Issue: Refactor: consolidate duplicated hashToken implementation across auth services

## Description
The SHA-256 token-hashing one-liner is reimplemented identically in three separate services.

## Problem
`src/auth/token.service.ts` (`hashToken`), `src/auth/password-reset.service.ts` (`#hashToken`), and `src/auth/authorization-request.service.ts` (`#hashToken`) all contain the identical:

```ts
createHash('sha256').update(token).digest('hex')
```

`TokenService.hashToken` is even documented as being exposed specifically "so `AuthService`'s refresh-token read paths hash exactly the same way the mint path does — the two cannot drift," yet `PasswordResetService` and `AuthorizationRequestService` reimplement the same primitive privately instead of importing it, undermining that "cannot drift" intent for token hashing project-wide.

`TokenService.hashToken` is also public and injected into `AuthService`, which calls `this.tokenService.hashToken(...)` in three places; `auth.service.spec.ts` mocks it as `tokenService.hashToken: jest.fn(...)`. `PasswordResetService`/`AuthorizationRequestService`'s `#hashToken` are private with no external callers.

## Expected Behavior
All token hashing in the backend goes through one shared function; every existing call site produces byte-identical output to today; `AuthService`'s existing injection/mock of `tokenService.hashToken` keeps working unchanged.

## Solution
Move the hashing one-liner into a small shared utility, `src/core/token-hash.ts`, exporting a plain `hashToken(token: string): string` — matching the existing plain-function-in-`src/core/` convention already used by `getNumberConfig` (`src/core/numeric-config.ts`).

`TokenService.hashToken` stays public but its body delegates to the shared util, so `AuthService`'s call sites and `auth.service.spec.ts`'s existing mock of `tokenService.hashToken` are unaffected. `PasswordResetService` and `AuthorizationRequestService` drop their private `#hashToken` methods entirely and import the shared util directly at each call site, since nothing external calls those private methods.

## Benefits
Removes the risk of the three hashing implementations silently diverging (e.g. if one is changed to a different algorithm or encoding without updating the others), and centralizes a security-relevant primitive in one tested location — without disturbing `AuthService`'s existing dependency-injection/mocking pattern.
