# DB harness, seed builders and intruder user

**Harness.** `buildIssuesDbHarness(env = {})`, modelled on `repositories-db-harness.ts`. It runs on the DB-tier test database (`buildDbTierOptions()`), with `ISSUES_ENTITIES` plus the entities its imports need and `ISSUES_PROVIDERS`. It wires Auth's real `AccountHandleService`, a `FakeClock`, a recording fake logger and `EventEmitterModule`. It returns `{ module, ds, clock, logger, get, close }`. Later issues extend it with `FakeWorkersService` and the GitHub fake.

**Seed builders.** Typed, with no recorded JSON. Each returns the inserted ids and uuid:

- `seedProject(ds, userId, { name?, description?, repositoryId?, deleted? })` — generates `uuid` with `randomUUID()`. With `deleted`, it sets `deleted_at` and `deleted_token = id` together.
- `seedIssue(ds, projectId, { title?, body?, state? })`
- `seedLink(ds, { userId, issueId, githubIssueId?, githubNumber?, status?, statusReason? })` — defaults to a `github_issue_id` above 2³¹ and the base snapshot copied from the issue.
- `seedMarker(ds, linkId, { revision?, markedAt? })`

**Intruder.** `seedIntruder(ds)` seeds a second user (reusing `seedUser` from Repositories' `two-user-baseline.ts`, or a local copy if importing it crosses the lint boundary) with its own project, issue, link and marker. It returns those ids so every spec can assert that the intruder's rows are untouched.

## Files to Change
- `backend/src/issues/tests/support/issues-db-harness.ts` — new.
- `backend/src/issues/tests/support/issues-seeds.ts` — new (the four builders and `seedIntruder`).
