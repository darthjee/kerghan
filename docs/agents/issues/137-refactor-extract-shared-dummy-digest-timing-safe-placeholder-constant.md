# Issue: Refactor: extract shared DUMMY_DIGEST timing-safe placeholder constant

## Description
The timing-safe placeholder bcrypt hash used to defend against username/approver-enumeration timing attacks is declared identically in two services.

## Problem
`backend/src/auth/auth.service.ts` and `backend/src/auth/authorization-request.service.ts` both declare the exact same constant:

```ts
const DUMMY_DIGEST = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q1eLXfPJvXQF4RUOgtnJhmiQq6Zsy';
```

used for the same purpose in both files:

```ts
const digest = row?.passwordDigest ?? DUMMY_DIGEST;
const valid = await bcrypt.compare(password, digest);
```

— a timing-safe bcrypt compare against a nonexistent row (missing user, or missing approver). `authorization-request.service.ts`'s comment explicitly says it "mirrors `AuthService#validateCredentials`'s `DUMMY_DIGEST`" — acknowledging the duplication in a comment rather than sharing the value.

## Expected Behavior
The dummy digest constant exists in exactly one place; both services import it, and the timing-safe-compare behavior is unchanged.

## Solution
Extract `DUMMY_DIGEST` into a new module-local file, following this repo's existing convention for helpers shared only within the auth module (e.g. `backend/src/auth/assert-any-field-present.ts` from issue #133), rather than `backend/src/core/` (reserved for helpers shared across modules, e.g. `numeric-config.ts`, `lockout-state.ts`).

Both call sites share the exact same "compare against dummy when the row is missing" pattern, so the extraction should also include a small `compareOrDummy(password, digest?)` helper wrapping `digest ?? DUMMY_DIGEST` + `bcrypt.compare`, imported by both `AuthService#validateCredentials` and `AuthorizationRequestService#approverPasswordValid`.

## Benefits
Prevents the two services' timing-safe-compare behavior from silently diverging, and removes a security-relevant magic string duplicated across files.
