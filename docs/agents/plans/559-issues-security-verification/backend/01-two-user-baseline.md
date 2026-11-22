# Two-user baseline in every DB harness

`testing.md#security-verification` requires the intruder user in every e2e and DB-backed harness. Today only `build-issues-test-app.ts` seeds an owner and an intruder. Change each DB harness and world builder so it seeds a second, approved user by default, with their own integration where the builder seeds one, and exposes it as `intruder`. Reuse `repositories/tests/support/two-user-baseline.ts` (`seedUser`, `seedIntegration`) and the existing `addLinkUser` and `seedUser` helpers instead of copying seed code.

Existing specs that count rows or assert "no other user" must keep passing. Where a spec assumed a single user (for example a global `count()`), scope the assertion to the owner. Remove the ad-hoc intruder seeding that now duplicates the default.

## Files to Change
- `backend/src/issues/tests/support/issues-db-harness.ts`: seed the intruder and expose it.
- `backend/src/issues/tests/support/issues-http-db-harness.ts`: seed the intruder and give it a session cookie helper.
- `backend/src/issues/tests/support/sync-fixture.ts` (`buildSyncWorld`): add an intruder with their own project, issue and link, so the sync specs prove they never touch it.
- `backend/src/issues/tests/support/link-fixture.ts` (`buildLinkWorld`): the same.
- Any `*.db-spec.ts` and `races/*.db-spec.ts` whose assertions assumed a single user: scope those assertions, and drop the duplicated ad-hoc seeding.
