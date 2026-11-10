# Account edit paths

**Parametrise `assertAnyFieldPresent`** to take the list of fields that count, with the message built from that list.

- **Account call:** `username`, `email`, `newPassword`, `githubHandle`. Presence for `githubHandle` means the key is in the body (`!== undefined`), so `null` counts. Message: `At least one of username, email, newPassword or githubHandle is required`.
- **Admin call:** the three managed fields, with today's message exactly (`At least one of username, email, or newPassword is required`). Note the comma difference: keep both strings as specified.
- `hasManagedField` is unchanged.

**`AccountService#updateAccount`** splits on `hasManagedField(dto)`.

- **Handle-only edit** (no managed field present):
  - flow: `assertAnyFieldPresent` → load user (`401` if missing) → write → `200`;
  - no default-user block, no lockout check, no `currentPassword` check (ignored if sent), and the abuse guard is never touched (no failure, no reset);
  - **no-op edit:** if the normalised value equals the stored `githubHandle`, skip the write and return the stored value.
- **Mixed or managed edit:** today's path, unchanged in order: default-user block → lockout → load → checks → write → reset → revoke.
  - Add: when `currentPassword` is missing, answer `400`. This failure counts toward the abuse guard, like a wrong password.
  - When `githubHandle` is also present, it is written in the same `save` as the other fields, so any refusal stores no handle.
- Move the handle-only branch into a private method or a small helper so `AccountService` stays under the line limit.

**`UserUpdateService#applyUserUpdate`** accepts an optional `githubHandle` in `changes`, applied when the key is present (`null` clears it). `AccountSummary` becomes `{ username, email, githubHandle }`.

- The admin path never passes `githubHandle`.
- `AdminService#editUser` uses the returned summary only indirectly: it re-reads the user and serialises it through the admin allowlist. Check that nothing admin-facing starts exposing `githubHandle`.

Update the docblocks on `AuthController#updateAccount` and `AccountService#updateAccount`: "always confirmed by their current password" is no longer true, and the response is `{ username, email, githubHandle }`.

## Files to Change
- `backend/src/auth/assert-any-field-present.ts`: parametrised field list and message.
- `backend/src/auth/admin.service.ts`: passes the admin field list.
- `backend/src/auth/account.service.ts`: handle-only path, no-op edit, `currentPassword` required only with a managed field.
- `backend/src/auth/user-update.service.ts`: `githubHandle` support, extended `AccountSummary`.
- `backend/src/auth/auth.controller.ts`: docblock for `updateAccount`.
