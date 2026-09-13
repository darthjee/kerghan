# Promote the apply/hash/persist step onto AuthService

`AccountService#applyUpdates` (private, `backend/src/auth/account.service.ts`) mutates
`username`/`email`, hashes `newPassword` (`bcrypt.hash(dto.newPassword, 10)`), saves via
`userRepository.save(user)`, and returns `{ username, email }` (the `AccountSummary` shape). Move
this body onto `AuthService` as a new public method, e.g.:

```ts
async applyUserUpdate(
  user: User,
  changes: { username?: string; email?: string; newPassword?: string },
): Promise<AccountSummary>
```

`AuthService` already has its own injected `userRepository` (used by `#assertAvailable`/
`#assertFieldAvailable`), so no new dependency is needed there. Move the `AccountSummary`
interface (currently exported from `account.service.ts`) alongside this method in `auth.service.ts`
so there is a single owner of both the type and the logic that produces it.

Update `AccountService.updateAccount` to call `this.authService.applyUserUpdate(user, dto)`
instead of its own private `#applyUpdates`, and delete `#applyUpdates` and the now-redundant
`AccountSummary` export from `account.service.ts` (import it from `auth.service.ts` instead,
wherever it's still referenced, e.g. the controller's return type).

Do not change `AccountService.updateAccount`'s existing behavior or its `UpdateAccountDto`
contract — this is a pure internal extraction, no change to `PATCH /auth/account.json`'s request/
response shape.

## Files to Change

- `backend/src/auth/auth.service.ts` — add `applyUserUpdate` (moved body of
  `AccountService#applyUpdates`) and the `AccountSummary` interface.
- `backend/src/auth/account.service.ts` — replace `#applyUpdates` with a call to
  `this.authService.applyUserUpdate(user, dto)`; remove the now-dead private method and the
  `AccountSummary` export, importing it from `auth.service.ts` instead.
