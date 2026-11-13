# Auth export: manager-aware user read and `UserDeletedEvent`

The sync-state row must be created only for a user who still exists, and that check must run in the same transaction as the insert (`model.md#user-deletion`). Repositories never queries `auth_users`, so Auth's export has to be able to join the caller's transaction.

- **Join the caller's transaction.** Add `AccountHandleService#lockExistingUser(userId: number, manager: EntityManager): Promise<boolean>` (or an optional `manager` on `getGithubHandle`, whichever reads cleaner; keep `getGithubHandle(userId)` working as today).
  - It runs `manager.getRepository(User)` with `.setLock('pessimistic_read')`, which is `SELECT … FOR SHARE` on MySQL 8, selecting only `id`.
  - It returns whether the row exists.
  - The shared lock makes a concurrent user delete wait until the caller's transaction commits. The `user.deleted` listener, which runs after the delete commits, then removes the new row.
  - JSDoc it as the only cross-module read the Repositories module may run inside its own transaction.
- **Event contract.** Add `auth/events/user-deleted.event.ts`, mirroring `integrations/events/integration-deleted.event.ts`:
  - `export const USER_DELETED = 'user.deleted'`;
  - `export class UserDeletedEvent { constructor(readonly userId: number) {} }`;
  - JSDoc: emitted with `emitAsync` after the user row's delete commits. There is no emitter yet (there is no deletion path); Repositories only listens.
- **Tests:**
  - unit: the method returns `false` for an unknown user and `true` for an existing one;
  - DB tier (`auth/tests/account-handle.service.db-spec.ts`): a concurrent `DELETE FROM auth_users` blocks until the transaction holding the shared lock commits. Assert the ordering with the delete's promise, not timers.

## Files to Change
- `backend/src/auth/account-handle.service.ts`: add the manager-aware, `FOR SHARE` existence read.
- `backend/src/auth/events/user-deleted.event.ts`: new; `USER_DELETED`, `UserDeletedEvent`.
- `backend/src/auth/tests/account-handle.service.spec.ts`: unit cases.
- `backend/src/auth/tests/account-handle.service.db-spec.ts`: new; the lock ordering.
