# Backend Plan: Refactor: extract shared DUMMY_DIGEST timing-safe placeholder constant

Main plan: [plan.md](plan.md)

## Overview
`backend/src/auth/auth.service.ts` and `backend/src/auth/authorization-request.service.ts` both declare the exact same `DUMMY_DIGEST` bcrypt hash and repeat the same `row?.passwordDigest ?? DUMMY_DIGEST` + `bcrypt.compare` pattern. Extract both into a new module-local file, following this module's existing convention for helpers shared only within `auth` (`backend/src/auth/assert-any-field-present.ts`, from issue #133), rather than `backend/src/core/` (reserved for helpers shared across modules, e.g. `numeric-config.ts`, `lockout-state.ts`).

## Context
- `AuthService#validateCredentials` (backend/src/auth/auth.service.ts:287-292): looks up the user by username, falls back to `DUMMY_DIGEST` when not found, then `bcrypt.compare`s the supplied password against the resulting digest — timing-safe against username enumeration.
- `AuthorizationRequestService#approverPasswordValid` (backend/src/auth/authorization-request.service.ts:291-296): same pattern, but against the approver row looked up by `approverUserId`.
- Both declare `const DUMMY_DIGEST = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q1eLXfPJvXQF4RUOgtnJhmiQq6Zsy';` verbatim; `authorization-request.service.ts`'s comment explicitly notes it mirrors `AuthService`'s copy instead of sharing it.
- Both digests are bcrypt hashes compared via the `bcrypt` package already imported in both files.

## Implementation Steps

### Step 1 — Add the shared `compareOrDummy` helper
Create `backend/src/auth/dummy-digest.ts` exporting:
- `DUMMY_DIGEST`: the existing hash constant, moved verbatim, with its explanatory comment (timing-safe placeholder against a nonexistent row).
- `compareOrDummy(password: string, digest?: string): Promise<boolean>`: wraps `bcrypt.compare(password, digest ?? DUMMY_DIGEST)`, encapsulating the exact `?? DUMMY_DIGEST` + `bcrypt.compare` pattern currently duplicated in both services.

Add `backend/src/auth/tests/dummy-digest.spec.ts` covering:
- `compareOrDummy` resolves to `true` when `digest` is provided and `password` matches it (mock/stub `bcrypt.compare` or use a real known hash+password pair, matching this repo's existing bcrypt-related test conventions).
- `compareOrDummy` resolves to `false` when `digest` is provided and `password` does not match it.
- `compareOrDummy` falls back to comparing against `DUMMY_DIGEST` when `digest` is `undefined`.

### Step 2 — Wire both services to the shared helper
- In `backend/src/auth/auth.service.ts`: remove the local `DUMMY_DIGEST` declaration and its comment; replace the `const digest = user?.passwordDigest ?? DUMMY_DIGEST; const valid = await bcrypt.compare(password, digest);` pair in `#validateCredentials` with `const valid = await compareOrDummy(password, user?.passwordDigest);`, importing `compareOrDummy` from `./dummy-digest.js`. Drop the `bcrypt` import if it becomes unused in this file.
- In `backend/src/auth/authorization-request.service.ts`: remove the local `DUMMY_DIGEST` declaration and its comment; replace `#approverPasswordValid`'s body the same way, importing `compareOrDummy` from `./dummy-digest.js`. Drop the `bcrypt` import if it becomes unused in this file. Update the JSDoc comment on the method above it (currently referencing `DUMMY_DIGEST` directly) to remain accurate.
- Confirm no other file references either service's local `DUMMY_DIGEST` (only the JSDoc comment does, already covered above).

## Files to Change
- `backend/src/auth/dummy-digest.ts` — new file: `DUMMY_DIGEST` constant + `compareOrDummy` helper.
- `backend/src/auth/tests/dummy-digest.spec.ts` — new file: unit tests for `compareOrDummy`.
- `backend/src/auth/auth.service.ts` — drop local `DUMMY_DIGEST`, use `compareOrDummy` in `#validateCredentials`.
- `backend/src/auth/authorization-request.service.ts` — drop local `DUMMY_DIGEST`, use `compareOrDummy` in `#approverPasswordValid`, keep its JSDoc accurate.

## CI Checks
- `backend/`: `docker-compose run kerghan_tests yarn coverage` and `docker-compose run kerghan_tests yarn lint` (CI jobs: `backend_tests`, `backend_checks`)

## Notes
- Behavior-preserving refactor only — no change to the timing-safe-compare semantics, error messages, or lockout logic in either service.
- Per this repo's boundaries (CLAUDE.md), run `yarn`/`npm`/tests through `docker-compose`, never directly on the host.
