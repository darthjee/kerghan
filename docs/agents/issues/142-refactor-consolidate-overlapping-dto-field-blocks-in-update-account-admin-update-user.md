# Issue: Refactor: consolidate overlapping DTO field blocks in update-account/admin-update-user

## Description
`UpdateAccountDto` and `AdminUpdateUserDto` share an identical block of `username`/`email`/`newPassword` validation decorators and types, and `assert-any-field-present.ts` separately re-declares the same three fields in its own local `FieldsDto` interface.

## Problem
`src/auth/dto/update-account.dto.ts` and `src/auth/dto/admin-update-user.dto.ts` have character-for-character identical `username`/`email`/`newPassword` field blocks (decorators + types); `UpdateAccountDto` only adds a `currentPassword` field on top. Both docstrings already cross-reference each other (one says it mirrors the other), showing the duplication is known but unaddressed. This means a change to a shared validation rule (e.g. `MinLength(8)` on `newPassword`) must be made in two files and could silently drift.

Separately, `src/auth/assert-any-field-present.ts` declares its own local `FieldsDto` interface with the same three fields, purely to type-check `assertAnyFieldPresent`'s parameter — a second, parallel duplication of the same shape.

## Expected Behavior
The shared `username`/`email`/`newPassword` validation rules are defined once; both DTOs keep their current public shape and validation behavior (including `UpdateAccountDto`'s extra `currentPassword` field). `assertAnyFieldPresent` type-checks its parameter against that same shared type instead of its own local interface.

## Solution
Extract a shared base/mixin DTO (e.g. `UserFieldChangesDto` with `username?`, `email?`, `newPassword?` and their existing decorators) that both `UpdateAccountDto` and `AdminUpdateUserDto` extend, adding only their own extra fields on top. Update `src/auth/assert-any-field-present.ts` to import and use `UserFieldChangesDto` (or an interface it satisfies) in place of its local `FieldsDto` interface.

## Benefits
Guarantees the two update paths can't have their shared validation rules silently drift apart, while keeping each DTO's own extra fields explicit. Removes a second, parallel duplication of the same three-field shape in `assert-any-field-present.ts`.
