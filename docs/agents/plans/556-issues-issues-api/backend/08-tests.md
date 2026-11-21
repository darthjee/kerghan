# Tests

Each test sits on the tier `docs/agents/specs/issues/testing.md` assigns:

- e2e with fakes for the HTTP contract;
- `(db)` for queries, locks, the marker and races.

Every DB-backed spec seeds the **intruder** (`seedIntruder`) and asserts its rows are untouched.

## Test app

Extend `tests/support/build-issues-test-app.ts`, or add a sibling `build-issues-api-test-app.ts`, to mount `IssuesController` with a `FakeIssuesService`, as `FakeProjectsService` is used for projects. Extend `issues-http-db-harness.ts` so the real `IssuesService` runs over MySQL for the route-level DB specs, with a fake `Clock` and a recording `IssueSyncTrigger`.

## e2e (fakes)

- **`issues.controller.access.e2e-spec.ts`**, a matrix over the five routes, mirroring `projects.controller.access.e2e-spec.ts`. It checks:
  - completeness;
  - `401` without a session;
  - `403` for a foreign Origin;
  - `X-Skip-Cache` and `no-store` on success, error and validation error;
  - no `GET`;
  - scoping to the session user;
  - non-uuid `:projectId` and `:issueId` answer `400`;
  - a project `404` and an issue `404` each have one byte-identical body whoever asks;
  - no internal id or `project_id` in any body.
- **`issues.controller.validation.e2e-spec.ts`**: the DTO table of step 02 over HTTP, with `400 VALIDATION_FAILED` and `error.details`, before any service call.

## DB-backed (`*.db-spec.ts`)

- **`issues.service.listing.db-spec.ts`:**
  - the `state` filter (default `open`, `closed`, `all`);
  - the sort is `created_at` desc then `id` desc (equal `created_at` values are ordered by id);
  - an edit does not reorder;
  - pagination and totals, with a page past the end empty;
  - literal search with `%`, `_` and `\` escaped, case-insensitive, on title only;
  - rows have no `body`;
  - the listing is scoped to the project: another project's issues and the intruder's never appear.
- **`issues.service.create.db-spec.ts`:**
  - the default `state`, a stored `body` normalization (`''` and `null` become `NULL`, whitespace kept);
  - a 4-byte title and body stored intact (E54);
  - `uuid` is unique;
  - `201` with `link: null`;
  - the cap is `ISSUES_LIMIT_REACHED` at `maxIssuesPerProject`;
  - no GitHub call and no trigger call.
- **`issues.service.edit.db-spec.ts`:**
  - an omitted field is unchanged, and `body: null` / `''` clears it;
  - a no-op edit: no write, `updated_at` unchanged, no marker, no revision bump, no trigger (E12);
  - `updated_at` has milliseconds;
  - unlinked: no marker, no trigger;
  - `linked` and `sync_failed` (seeded with `seedLink`):
    - the marker is created with `revision = 1` and `marked_at` set;
    - a second edit bumps `revision` and `updated_at` and keeps `marked_at`;
    - the trigger is called once after the commit with that link id;
  - `gone`: no marker, no trigger;
  - a forced failure after the issue update (for example a throwing marker upsert) rolls back both and calls no trigger (E52);
  - a throwing trigger still answers `200` with the edit committed.
- **`issues.service.delete.db-spec.ts`:**
  - an unlinked issue is hard-deleted, and the response is `{}`;
  - a second delete answers `404`;
  - a link in each status (`linked`, `sync_failed`, `gone`) answers `409 ISSUE_LINKED` and the issue stays;
  - no GitHub call.
- **`issues.routes.db-spec.ts`** (HTTP over MySQL, like `projects.routes.db-spec.ts`):
  - another user's project, a deleted project and an issue of another project answer `404` on every route;
  - the edit rate limit answers `429` with `Retry-After` and `retryAfterSeconds` after `editMaxPerWindow` edits, **before** the access check (a missing project still answers `429` once over the limit);
  - a refused call consumes nothing.

## Races (`tests/races/`, `(db)`)

- **`issue-cap.race.db-spec.ts`:** two creations at `max - 1` on one project. Exactly one wins and the other answers `ISSUES_LIMIT_REACHED`, held apart by the project row lock (same technique as `project-cap.race.db-spec.ts`).
- **`issue-edit-marker.race.db-spec.ts` (E42):** two simultaneous edits of one linked issue.
  - Both upserts land, `revision = 2` (or the marker exists with a revision bumped by each), and the issue row is last-write-wins.
- **`issue-delete-vs-project-delete`** (optional, if cheap): a delete waiting on a held project lock answers `404` once the project deletion commits.

## Static specs

Update `tests/module-boundaries.spec.ts`, `tests/eslint-boundary.spec.ts` and `tests/column-allowlist.spec.ts` if they enumerate sources or columns, so they cover the new files. Confirm that `tests/projects.no-github.spec.ts` (or an `issues.no-github` sibling) asserts that the issue service has no GitHub or queue dependency.

## Files to Change

- `backend/src/issues/tests/support/*` — the test app, the fake service, the harness and a recording trigger.
- `backend/src/issues/tests/issues.controller.access.e2e-spec.ts`, `issues.controller.validation.e2e-spec.ts` — new.
- `backend/src/issues/tests/issues.service.{listing,create,edit,delete}.db-spec.ts`, `issues.routes.db-spec.ts` — new.
- `backend/src/issues/tests/races/issue-cap.race.db-spec.ts`, `issue-edit-marker.race.db-spec.ts` — new.
- The existing static specs — extended where they list sources.
