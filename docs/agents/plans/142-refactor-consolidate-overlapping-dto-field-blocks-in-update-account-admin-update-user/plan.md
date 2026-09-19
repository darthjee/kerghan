# Plan: Refactor: consolidate overlapping DTO field blocks in update-account/admin-update-user

Issue: [142-refactor-consolidate-overlapping-dto-field-blocks-in-update-account-admin-update-user.md](../issues/142-refactor-consolidate-overlapping-dto-field-blocks-in-update-account-admin-update-user.md)

## Overview
Extracts the identical `username`/`email`/`newPassword` validation block shared by `UpdateAccountDto` and `AdminUpdateUserDto` into a single `UserFieldChangesDto`, and points `assertAnyFieldPresent`'s parameter type at that same shared type instead of its own local `FieldsDto` interface.

See [backend.md](backend.md) for the full plan.
