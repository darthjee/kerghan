# backend Plan: Refactor: extract shared assertAnyFieldPresent validation from AccountService/AdminService

Main plan: [plan.md](plan.md)

## Overview

`backend/src/auth/account.service.ts:78` (`#assertAnyFieldPresent(dto: UpdateAccountDto)`) and
`backend/src/auth/admin.service.ts:140` (`#assertAnyFieldPresent(dto: AdminUpdateUserDto)`) both
contain the exact same body:

```ts
if (!dto.username && !dto.email && !dto.newPassword) {
  throw new BadRequestException('At least one of username, email, or newPassword is required');
}
```

`UpdateAccountDto` and `AdminUpdateUserDto` (`backend/src/auth/dto/`) both declare optional
`username`/`email`/`newPassword` fields, so the two private methods can be replaced by one shared
free function taking a structural type. Pure refactor: `AccountService#updateAccount` and
`AdminService#editUser` must behave identically before and after.

## Context

- `AccountService#updateAccount` (`account.service.ts:66`) calls `this.#assertAnyFieldPresent(dto)`
  as its first validation step, before the lockout check.
- `AdminService#editUser` (`admin.service.ts:127`, not `updateUser` — that name does not exist)
  calls `this.#assertAnyFieldPresent(dto)` as its first step, before loading the user.
- No existing `utils`/`shared`/`helpers` folder exists under `backend/src/` — `backend/src/core/`
  holds NestJS decorators/guards/services, not plain pure functions, so it's not the right home.
  Add the new file directly under `backend/src/auth/` per the issue's own suggestion.
- Existing coverage: `backend/src/auth/tests/account.service.spec.ts` (~`:232`) and
  `backend/src/auth/tests/admin.service.spec.ts` (~`:264`) both already assert the "no field
  present" case rejects with `BadRequestException` calling the service method with `{}` — these
  must keep passing unchanged as the behaviour-drift guard; no new test file is required, but add
  a small dedicated unit spec for the extracted function itself (see Step 2).
- `AGENT_SPLIT=false`, single owner `backend` (pure TypeScript/NestJS change confined to
  `backend/src/auth/`). No other configured agent (`frontend`, `infra`, `proxy`, `cache`,
  `security`, `data-access`, `product-owner`) has work here.

## Implementation Steps

### Step 1 — Extract the shared helper and rewire both services

- New `backend/src/auth/assert-any-field-present.ts`:
  - `export function assertAnyFieldPresent(dto: { username?: string; email?: string;
    newPassword?: string }): void` — body moved verbatim from either private method (same
    condition, same `BadRequestException` message).
  - Import `BadRequestException` from `@nestjs/common`.
- `backend/src/auth/account.service.ts`:
  - Import `assertAnyFieldPresent` from `./assert-any-field-present.js`.
  - Replace `this.#assertAnyFieldPresent(dto)` in `updateAccount` with
    `assertAnyFieldPresent(dto)`.
  - Delete the private `#assertAnyFieldPresent` method.
- `backend/src/auth/admin.service.ts`:
  - Import `assertAnyFieldPresent` from `./assert-any-field-present.js`.
  - Replace `this.#assertAnyFieldPresent(dto)` in `editUser` with `assertAnyFieldPresent(dto)`.
  - Delete the private `#assertAnyFieldPresent` method.
- `UpdateAccountDto` and `AdminUpdateUserDto` both already structurally satisfy the shared
  function's parameter type (optional `username`/`email`/`newPassword`), so no DTO changes are
  needed.

### Step 2 — Tests

- New `backend/src/auth/tests/assert-any-field-present.spec.ts`:
  - Throws `BadRequestException('At least one of username, email, or newPassword is required')`
    when `username`, `email`, and `newPassword` are all absent (`{}`).
  - Does not throw when at least one of the three is present (three cases, one per field).
- `backend/src/auth/tests/account.service.spec.ts` and
  `backend/src/auth/tests/admin.service.spec.ts` — no changes expected; both already exercise the
  "no field present" rejection through the public service method and must keep passing as-is,
  proving the extraction didn't change observable behaviour.

## Files to Change

- `backend/src/auth/assert-any-field-present.ts` — new: shared `assertAnyFieldPresent` function.
- `backend/src/auth/account.service.ts` — call the shared function; delete the private copy.
- `backend/src/auth/admin.service.ts` — call the shared function; delete the private copy.
- `backend/src/auth/tests/assert-any-field-present.spec.ts` — new unit spec for the shared
  function.

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests` — runs
  `npm run coverage`)
- `backend/`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks` — runs
  `npm run lint`)

## Notes

- Behaviour must not change: same trigger condition (all three fields absent), same exception
  type, same exact message, same call-site position (first validation step) in both
  `updateAccount` and `editUser`.
- No migration, no endpoint, no response-shape, no frontend, no proxy change — this is an
  internal backend-only refactor.
