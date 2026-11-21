# E2E, DB and race tests

The tiers follow `docs/agents/specs/issues/testing.md`: e2e with fakes by default, with races and query counts `(db)`.

- **Test app:** `issues/tests/support/build-issues-test-app.ts`, copied from `build-repositories-test-app.ts`. It provides:
  - the global `ValidationPipe({ whitelist: true, transform: true })`;
  - `HttpExceptionFilter`, `JwtGuard`, `OriginGuard` and `CachePolicyInterceptor`;
  - `FakeClock`;
  - a `FakeRepositoriesService` for `resolveForProject`/`projectSummaries`.

  A DB-backed variant on `issues-db-harness.ts` serves the routes-level DB specs.
- **E2E (`projects.controller.*.e2e-spec.ts`):**
  - Every outcome and code of the seven routes: the creation paths `200`/`201`/`409`, edit, repository, delete with `unsentIssueCount`, and `error.meta` contents.
  - `400` for strict types, code-point lengths with a 4-byte character, trimming, `null` handling and malformed uuids.
  - The no-GitHub/no-job assertion: the fakes record no call.
- **Access matrix rows** (`projects.controller.access.e2e-spec.ts`) for these seven routes:
  - `401` without a session, `OriginGuard` refusal, `X-Skip-Cache: true` and `Cache-Control: no-store` on success and on handler errors, and no `GET`.
  - Another user's or a deleted project answers `404` with byte-identical bodies.
  - No response contains an internal id, `user_id` or an integration field.
  - Build it so #559 can extend it to all 19 routes.
- **Races (`races/*.race.db-spec.ts`):**
  - Two simultaneous explicit creations on one repository: one `201`, one `409 PROJECT_REPOSITORY_TAKEN`.
  - The same on the shortcut: one `201`, and the loser re-reads and answers `200` with the winner.
  - Two simultaneous creations or renames to one name: one wins, the other `409 PROJECT_NAME_TAKEN`.
  - Two simultaneous creations at `max - 1` projects: exactly one passes the cap. This proves the exclusive user lock of step 05.
  - The change side of E62: while another transaction holds the project row lock (`SELECT … FOR UPDATE` from the test), a repository change waits, and once a link is inserted and committed it answers `409 PROJECT_HAS_LINKS`. The full race against real link creation is #557's.
- **Edge cases** E25 to E29 and E33 to E40 that concern projects and status mapping: create with an Unavailable or Unknown repository, a summary after a rename, a dangling reference reading `unavailable`.
- **`user.deleted`** keeps removing soft-deleted projects too. Extend `user-deleted.listener.db-spec.ts` with a tombstone row if it is not already covered.

## Files to Change
- `backend/src/issues/tests/support/build-issues-test-app.ts`, `fake-repositories.service.ts` (or reuse the Repositories one) — test app and doubles (new).
- `backend/src/issues/tests/projects.controller.access.e2e-spec.ts`, `projects.controller.create.e2e-spec.ts`, `projects.controller.manage.e2e-spec.ts`, `projects.controller.validation.e2e-spec.ts` — e2e specs (new).
- `backend/src/issues/tests/races/project-create.race.db-spec.ts`, `project-cap.race.db-spec.ts`, `project-repository-change.race.db-spec.ts` — race specs (new).
- `backend/src/issues/tests/user-deleted.listener.db-spec.ts` — tombstone case, if missing.
