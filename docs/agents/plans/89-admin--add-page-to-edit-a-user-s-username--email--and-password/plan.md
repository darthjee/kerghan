# Plan: Admin: add page to edit a user's username, email, and password

Issue: [89-admin--add-page-to-edit-a-user-s-username--email--and-password.md](../../issues/89-admin--add-page-to-edit-a-user-s-username--email--and-password.md)

## Overview

Adds an admin-only "Edit" flow for a target user's `username`/`email`/password: a new
`POST admin/users/:id/edit.json` endpoint on the existing `AdminController`/`AdminService`, and a
new Admin edit page reachable from a new "Edit" link on the Admin Users table. No current-password
check, matching #88's plumbing but ungated. #88 has already landed on `main`
(`backend/src/auth/account.service.ts`'s `AccountService`); this issue extracts its
apply/hash/persist step onto `AuthService` so both `AccountService` (self-service) and the new
admin flow share it, instead of duplicating bcrypt hashing/persistence logic.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

- **Endpoint**: `POST admin/users/:id/edit.json`, guarded by `AdminController`'s existing
  class-level `@AdminOnly()` (no current-password check).
- **Request body** (`AdminUpdateUserDto`): `{ username?: string, email?: string, newPassword?:
  string }` — at least one field required; no `currentPassword`, and (matching
  `UpdateAccountDto`/`RegisterDto`/`ResetPasswordDto` convention) no `newPasswordConfirmation`
  field — password-confirmation equality is checked client-side only, the same way
  `MyAccountController` already does it for #88.
- **Success response**: `{ user: { id, email, username, isAdmin, createdAt } }`, the same shape
  `AdminController#serializeUser` already produces for the `search` route — the frontend edit page
  reads `user.username`/`user.email` back into its form on success, the same way `MyAccount.jsx`
  reflects `AccountsClient.updateAccount`'s `{username, email}` response.
- **Error surfacing**: failures (duplicate `username`/`email`, password too short, unknown user id)
  throw `BadRequestException`/`NotFoundException` the same way every other `AdminController`/
  `AuthController` route does; the frontend reads `error.message` off the thrown `ApiError`
  exactly like `MyAccountController` does today — no new error-shape work needed on either side.
- **Route/page**: frontend page lives at hash route `#/admin/users/:id/edit` (page key
  `admin-user-edit`), calling a new `AdminClient.editUser(userId, payload)` method that hits the
  endpoint above.
