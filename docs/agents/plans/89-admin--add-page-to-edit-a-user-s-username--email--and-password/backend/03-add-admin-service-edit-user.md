# Add AdminService.editUser

Inject `AuthService` into `AdminService`'s constructor (it currently only takes `userRepository`,
`passwordResetService`, `mailService` — both `AdminService` and `AuthService` already live in the
same `AuthModule`, so no module wiring/export change is needed). Add:

```ts
async editUser(userId: number, dto: AdminUpdateUserDto): Promise<User> {
  this.#assertAnyFieldPresent(dto);

  const user = await this.#findUserOrThrow(userId);
  const username = dto.username && dto.username !== user.username ? dto.username : undefined;
  const email = dto.email && dto.email !== user.email ? dto.email : undefined;

  await this.authService.assertAvailableForUpdate(user.id, username, email);
  await this.authService.applyUserUpdate(user, dto);

  return this.#findUserOrThrow(userId);
}
```

(Re-fetching after `applyUserUpdate` — or having `applyUserUpdate` return the saved `User` entity
instead of the narrower `AccountSummary`, whichever reads cleaner once step 01 is implemented — is
an implementation detail; the controller needs the full `User` row to call
`#serializeUser` on, unlike `AccountService.updateAccount`'s narrower `{username, email}` need.)

`#assertAnyFieldPresent` mirrors `AccountService`'s identical one-liner (`BadRequestException` when
`username`/`email`/`newPassword` are all absent) — a small enough duplication that extracting it
isn't worth a shared helper (the issue's "share update logic" concern is about
hashing/persistence/uniqueness, already handled by `AuthService`, not this one-line presence
check).

This method works identically when `userId` is the calling admin's own id — no special-casing,
since there's no current-password check to skip in the first place.

## Files to Change

- `backend/src/auth/admin.service.ts` — inject `AuthService`, add `editUser` and
  `#assertAnyFieldPresent` as above.
