# Issue: Admin: add page to edit a user's username, email, and password

## Description

The Admin Users page (`frontend/assets/js/components/resources/admin/pages/AdminUsers.jsx`) can
currently only search for accounts and, per row, "Generate link" or "Send email" for password
recovery — there is no way for an admin to directly edit a user's account. This issue adds an
"Edit" link per row, opening a page where an admin can change that user's `username`, `email`, and
`password` — much like #88's self-service My Account page (now merged), but **without** requiring
the target user's current password, since the admin is acting on their behalf.

This issue is independent of #88, but the two should share the same underlying update logic
(username/email-uniqueness checks, password hashing) rather than duplicating it — see Solution
below for the concrete reuse points now that #88 has landed.

## Problem

- Admins have no way to correct a user's `username`/`email` or set a new password directly; the
  only lever today is the password-recovery-link/email flow.

## Expected Behavior

- Each row in the Admin Users table gets a new "Edit" action/link, alongside "Generate link" and
  "Send email", routing to a new admin edit page for that user (e.g. `#/admin/users/:id/edit`).
- The page shows the target user's current `username` and `email` in editable fields, plus a
  "set new password" section (new password + confirmation) — no current-password field, since this
  is an admin action.
- Saving `username` and/or `email` does not require any password confirmation from the admin or
  the target user.
- A duplicate `username` or `email` (unique constraints on `auth_users`) surfaces a clear inline
  error instead of a raw 500/DB error.
- An admin can use this page to edit their own account too (editing self via this page still skips
  the current-password check — for confirming their *own* password, they'd use #88's My Account
  page instead).
- The `isAdmin` flag is **out of scope** for this issue — remains read-only here.
- On success, the page confirms the update and reflects the new `username`/`email` in the Admin
  Users table.

## Solution

### Scope

Backend + frontend together, single issue.

**Backend**
- New endpoint on `AdminController` (`backend/src/auth/admin.controller.ts`): `POST
  admin/users/:id/edit.json`, matching the existing route style used by
  `recovery-link.json`/`send-recovery-email.json`, guarded by the controller-level `@AdminOnly()` —
  no current-password check.
- Request DTO: new `AdminUpdateUserDto` (optional `username`, `email`,
  `newPassword`/`newPasswordConfirmation`, `@MinLength(8)` on the password) — at least one field
  must be present; no `currentPassword` field, unlike #88's `UpdateAccountDto`
  (`backend/src/auth/dto/update-account.dto.ts`).
- Reuse `AuthService.assertAvailableForUpdate(excludeUserId, username?, email?)`
  (`backend/src/auth/auth.service.ts`, around lines 210-222) directly for the uniqueness check —
  this is already shared/reusable and is what `AccountService` calls for #88's self-service flow.
- Extract the apply/hash/persist step: today it's a private `AccountService#applyUpdates` method
  (`backend/src/auth/account.service.ts`) that hashes the new password with `bcrypt` and persists
  the changes, only reachable via `AccountService.updateAccount`'s password-gated flow. Pull this
  into a method both `AccountService` and `AdminService` can call (e.g. promote it onto
  `AuthService`, or a small shared helper) instead of duplicating the hash/persist logic inside
  `AdminService`. `AdminService` (`backend/src/auth/admin.service.ts`) doesn't currently depend on
  `AuthService` — that dependency needs to be added either way. The exact shape (which class ends
  up owning the extracted method) is left to backend/architect judgment.
- While extracting, note `AuthService.register` also has its own inline `bcrypt.hash` call
  duplicating what `AccountService#applyUpdates` does — folding both into one shared hashing step
  is encouraged but not required by this issue's acceptance criteria.
- `X-Skip-Cache` set on the response, following every other route in this controller.

**Frontend**
- New "Edit" link per row in `AdminUsersHelper.#renderRow`
  (`frontend/assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx`), threaded
  through `AdminUsersController.js` and `AdminUsers.jsx`, routing to a new admin edit page at
  `#/admin/users/:id/edit`. No `:id`-parameterized route exists yet under
  `frontend/assets/js/components/resources/admin/pages/`, so this page establishes that pattern.
- Form fields for `username`, `email`, and a password-set section; inline validation/error display
  for the failure cases above (no current-password field). #88's My Account page
  (`frontend/assets/js/components/resources/accounts/pages/MyAccount.jsx`, with
  `controllers/MyAccountController.js` / `helpers/MyAccountHelper.jsx`) is mirror-worthy for layout
  but not directly reusable as-is, since it requires `currentPassword`.

### Acceptance criteria

- [ ] The new admin edit endpoint requires `@AdminOnly()` (a non-admin or unauthenticated request
      is rejected) and performs no current-password check.
- [ ] Updating a user's `username`/`email` to one already used by another account fails with a
      clear error (no raw DB/500 error).
- [ ] Setting a new password for a user validates it (`min length 8`) and results in that user's
      stored `passwordDigest` being updated, without requiring their current password.
- [ ] The Admin Users table has a new "Edit" action per row routing to the new page.
- [ ] The admin edit page lets an admin view/edit a target user's `username`/`email` and set a new
      password, surfacing the error cases above inline, and works when the target is the admin's
      own account.
- [ ] The `isAdmin` flag is not editable from this page.
- [ ] New backend and frontend tests cover the success path and each failure case above.

## Benefits

- Gives admins a direct way to fix a user's account details without routing through the
  password-recovery flow.
- Establishes shared update logic with #88 instead of two divergent implementations of the same
  username/email/password-change validation — building on the uniqueness check #88 already made
  reusable via `AuthService.assertAvailableForUpdate`.
