# Backend Plan: Admin: add page to edit a user's username, email, and password

Main plan: [plan.md](plan.md)

## Shared contracts

- Produces `POST admin/users/:id/edit.json`, request `{ username?, email?, newPassword? }`
  (`AdminUpdateUserDto`, no `currentPassword`/`newPasswordConfirmation`), success response
  `{ user: { id, username, email, isAdmin, createdAt } }` (via `AdminController#serializeUser`),
  errors as `BadRequestException`/`NotFoundException` — see [plan.md](plan.md)'s "Shared contracts"
  for the full contract the frontend relies on.

## Context

`AccountService.updateAccount` (`backend/src/auth/account.service.ts`, from #88) already calls
`AuthService.assertAvailableForUpdate(excludeUserId, username?, email?)`
(`backend/src/auth/auth.service.ts`) for the uniqueness check — that part is already
shared/reusable as-is. The apply/hash/persist step, however, is a private
`AccountService#applyUpdates` method: it mutates `username`/`email`, hashes `newPassword` with
`bcrypt.hash(..., 10)`, and saves via `AccountService`'s own injected `userRepository` — not
reachable from `AdminService` today. `AdminService` (`backend/src/auth/admin.service.ts`) doesn't
currently depend on `AuthService` at all.

## Steps

- [01 — Promote the apply/hash/persist step onto AuthService](backend/01-extract-shared-update-logic.md)
- [02 — Add AdminUpdateUserDto](backend/02-add-admin-update-user-dto.md)
- [03 — Add AdminService.editUser](backend/03-add-admin-service-edit-user.md)
- [04 — Add the AdminController edit route](backend/04-add-admin-controller-edit-route.md)
- [05 — Tests](backend/05-tests.md)

## CI Checks

- `backend`: `docker-compose run kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- The exact class that ends up owning the extracted method is a judgment call made concrete in
  step 01 (`AuthService`, since it already owns the injected `userRepository` and
  `assertAvailableForUpdate`) — feel free to deviate if implementation surfaces a better fit, per
  the issue's "left to backend/architect judgment" note.
- Folding `AuthService.register`'s own inline `bcrypt.hash` call into the same shared hashing step
  is encouraged (removes a second `bcrypt.hash(..., 10)` call site) but not required by the
  issue's acceptance criteria — do it only if it doesn't complicate step 01.
- The `isAdmin` flag must stay out of `AdminUpdateUserDto` entirely (not just unused) — the issue
  keeps it read-only.
