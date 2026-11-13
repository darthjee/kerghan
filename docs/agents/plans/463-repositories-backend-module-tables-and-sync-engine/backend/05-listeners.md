# Listeners: `integration.deleted` and `user.deleted`

Both listeners live in a provider of the always-on `RepositoriesModule`, so they are registered at boot (`integrations.md#deletion-hook`, `model.md#logical-foreign-keys`, `#user-deletion`).

- **`@OnEvent(INTEGRATION_DELETED)`** `(IntegrationDeletedEvent { userId, integrationId })` runs one transaction. Every statement has `AND user_id = :userId`:
  1. delete the source, page and status rows with `source_key = 'integration:<id>'`;
  2. clear `integration_id` where it equals the id;
  3. prune.

  It catches its own error and logs it with safe fields (`userId`, `integrationId`, error class), so the `204` stands.
- **`@OnEvent(USER_DELETED)`** `(UserDeletedEvent { userId })` runs one transaction that deletes the user's rows from all five tables (`WHERE user_id = :userId`). On failure it logs at **error** level with `userId` and the error class, and never throws.
- **Tests:**
  - `(db)`: the cleanup deletes and clears exactly as listed, keeps added repos (Unavailable), prunes not-added ones and leaves the intruder's same-`github_id` rows untouched;
  - `(db)`: `user.deleted` empties the five tables for that user only; a failure is logged at error level and does not throw;
  - `(e2e)`: deleting an integration through the real `IntegrationsService` before any Repositories request still runs the cleanup (the listener is registered at boot). This is the case `integrations.md#required-tests` moved to #463.

## Files to Change
- `backend/src/repositories/repositories-events.listener.ts`: new; both listeners.
- `backend/src/repositories/repositories.module.ts`: provide the listener.
- `backend/src/repositories/tests/integration-deleted.listener.db-spec.ts`, `user-deleted.listener.db-spec.ts`: new.
- `backend/src/repositories/tests/integration-deleted.at-boot.db-spec.ts`: new; boots the real `AppModule` wiring on the DB tier.
