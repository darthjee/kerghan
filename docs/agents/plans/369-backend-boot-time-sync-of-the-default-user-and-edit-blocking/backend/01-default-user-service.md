# DefaultUserService: boot sync and default-user identity

Create the service that synchronizes the default user at boot and is the single place that knows which row is the default user.

- Add `DEFAULT_USER_MANAGED: 'DEFAULT_USER_MANAGED'` to `ErrorCodes`.
- New `DefaultUserService` (`@Injectable`, implements `OnApplicationBootstrap`), injecting `Repository<User>`, `DefaultUserConfig`, `TokenService` and `LoggerService`. Register it in `AuthModule.providers`.
- `onApplicationBootstrap()`: return immediately when `!config.isEnabled()` (no id held). Otherwise run `sync()` and store the resulting row's id in a private field.
- `sync()`:
  1. Look up by configured username (`findOneBy({ username })`, so the DB collation applies).
  2. Email collision: if a user with the configured email exists and its id differs from the matched row (or there is no matched row), throw an `Error` with a clear message naming the conflict ("default user email already belongs to another user"). Never include the password. This aborts boot.
  3. No row: create it with username, email, `bcrypt.hash(password, 10)` and `isAdmin`. If the insert fails with `ER_DUP_ENTRY` (a `QueryFailedError`, same detection as `account-edit-abuse-guard.service.ts`), re-fetch by username and fall through to the update path. If the re-fetch finds nothing, rethrow the original error.
  4. Existing row: set `email` and `isAdmin`. Only when `!(await bcrypt.compare(password, row.passwordDigest))`, set a new digest and, after saving, call `tokenService.revokeUserTokens(row.id, RevokedReason.ADMIN_PASSWORD_CHANGE)`. Save only when something changed, or always; either is acceptable, but no rehash when the password is unchanged.
  5. Return the row. Its id becomes the default-user id.
- `isDefaultUser(userId: number): boolean`: `true` only when enabled, an id is held, and it equals `userId`.
- `assertNotDefaultUser(userId: number): void`: throws `new ConflictException({ code: ErrorCodes.DEFAULT_USER_MANAGED, message: 'This user is managed by environment configuration and cannot be edited' })` when `isDefaultUser(userId)`. Export the message as a constant so specs and every call site share it.
- Unit spec `default-user.service.spec.ts`, with mocked repo (`repo-mock.test-support.ts` / `in-memory-repo.ts`) and a real `DefaultUserConfig` built from settings, covering every case in boot-sync.md's "Required tests": create; overwrite email and admin flag; unchanged password → no rehash, no revocation; changed password → rehash + `revokeUserTokens(id, ADMIN_PASSWORD_CHANGE)`; email belongs to another user → boot throws; `ER_DUP_ENTRY` on insert → update path; disabled → no repository call, `isDefaultUser` always false; recorded id for both created and matched rows; `assertNotDefaultUser` throws the documented code/message only for the default id.

## Files to Change
- `backend/src/core/error-codes.ts` — add `DEFAULT_USER_MANAGED`.
- `backend/src/auth/default-user.service.ts` — new service (boot sync, id holder, `isDefaultUser`, `assertNotDefaultUser`, message constant).
- `backend/src/auth/auth.module.ts` — register `DefaultUserService`.
- `backend/src/auth/tests/default-user.service.spec.ts` — new unit spec.
