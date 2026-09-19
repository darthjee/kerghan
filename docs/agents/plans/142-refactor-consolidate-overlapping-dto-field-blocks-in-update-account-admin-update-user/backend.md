# Backend Plan: Refactor: consolidate overlapping DTO field blocks in update-account/admin-update-user

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared UserFieldChangesDto](backend/01-extract-shared-user-field-changes-dto.md)
- [02 — Extend it from UpdateAccountDto and AdminUpdateUserDto](backend/02-extend-dtos-from-shared-base.md)
- [03 — Point assertAnyFieldPresent at the shared type](backend/03-update-assert-any-field-present.md)

## CI Checks

- `backend/`: `docker-compose run kerghan_tests yarn coverage` and
  `docker-compose run kerghan_tests yarn lint` (CI jobs: `backend_tests`, `backend_checks`) —
  no new tests are required (both DTOs' public shape and validation behavior are unchanged), but
  existing specs covering `UpdateAccountDto`, `AdminUpdateUserDto`, and `assertAnyFieldPresent`
  must keep passing unmodified.

## Notes
- Pure internal refactor: no endpoint, request/response shape, or validation-rule change. Do not
  touch `auth.controller.ts` or `admin.controller.ts` beyond what inheritance requires (nothing —
  both keep importing their own DTO class from the same path).
- `class-validator` decorators on inherited fields carry over transparently through TypeScript
  class inheritance — no re-declaration or `@Type()`/`@ValidateNested()` needed on the subclasses.
