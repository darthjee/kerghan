# Issue: Refactor: extract shared assertAnyFieldPresent validation from AccountService/AdminService

## Description
`AccountService` and `AdminService` each implement a private "at least one field present" validation with byte-identical logic.

## Problem
`src/auth/account.service.ts` (`#assertAnyFieldPresent`) and `src/auth/admin.service.ts` (`#assertAnyFieldPresent`) both contain:

```ts
if (!dto.username && !dto.email && !dto.newPassword) {
  throw new BadRequestException('At least one of username, email, or newPassword is required');
}
```

They operate on structurally identical DTO shapes (`UpdateAccountDto` and `AdminUpdateUserDto`, both with optional `username`/`email`/`newPassword`). A future field addition to this rule requires remembering to update it in two places, risking silent drift between the account-self-service and admin-user-edit code paths.

## Expected Behavior
The "at least one field present" validation is defined once and reused by both services; behavior for both `AccountService#updateAccount` and `AdminService#editUser` is unchanged.

## Solution
Extract a shared helper (e.g. a free function `assertAnyFieldPresent(dto: { username?: string; email?: string; newPassword?: string })` in a small shared module under `src/auth/`), and have both `AccountService` and `AdminService` call it instead of each declaring their own private copy.

## Benefits
Removes a duplicated validation rule that could silently diverge between the account and admin update paths, and reduces boilerplate in both services.
