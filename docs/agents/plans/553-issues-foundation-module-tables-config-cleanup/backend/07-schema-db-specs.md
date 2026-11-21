# Schema-level DB specs

All on the DB-backed tier (`*.db-spec.ts`), each one seeding the intruder user.

- **Migrations** (`database/tests/issues-migrations.db-spec.ts`, as in `repositories-migrations.db-spec.ts`): `up` creates the four tables in order, with the indexes of `model.md#indexes` (names, columns, uniqueness). `down` in reverse drops them. No physical foreign key exists.
- **Tables** (`issues/tests/issues-tables.db-spec.ts`):
  - unique (`user_id`, `name`, `deleted_token`) and (`user_id`, `repository_id`, `deleted_token`) reject live duplicates and accept a duplicate once the first project is soft-deleted (`deleted_token = id`);
  - a `NULL` repository never collides;
  - names that differ only by case or accents collide (utf8mb4_0900_ai_ci);
  - unique `uuid` on projects and issues;
  - links: unique (`user_id`, `github_issue_id`), but two users may link the same id (E45); unique `issue_id`;
  - markers: unique `link_id`;
  - a 4-byte character in a title and body round-trips (E54);
  - `github_issue_id` above 2³¹ round-trips as a JS number (E56);
  - `issues.updated_at` round-trips milliseconds;
  - `status_reason` is `NULL` for `linked` and holds `deleted` or `moved` for `gone`;
  - `deleted_token` is never `0` for a deleted project (E50).
- **Access check** (`issues/tests/issues-access.db-spec.ts`):
  - the owner's live project resolves;
  - a missing, foreign (intruder) and soft-deleted project each throw the identical `404` `Project not found`;
  - `findIssueInProject` answers `404` `Issue not found` for an issue of another project or of the intruder;
  - `lock: true` runs inside a transaction.
- **Cleanup** (`issues/tests/user-deleted.listener.db-spec.ts`):
  - after `onUserDeleted`, the user's markers, links, issues and projects (live and soft-deleted) are gone, and the intruder's rows are intact;
  - the operation is idempotent for a user with no rows;
  - a forced failure (e.g. a spied manager throwing) logs `issues user.deleted cleanup failed` with only `userId` and `errorClass`, and resolves without throwing (E53);
  - the event fired through `EventEmitter2` reaches the listener.
- Cover the edge-case rows that #553 can exercise (E45, E50, E54, E56, E53). Leave the behavioural rows (E41–E44, E46–E49, E51, E52, E55, E12, E14, E16) to their owning issues.

## Files to Change
- `backend/src/database/tests/issues-migrations.db-spec.ts` — new.
- `backend/src/issues/tests/issues-tables.db-spec.ts` — new.
- `backend/src/issues/tests/issues-access.db-spec.ts` — new.
- `backend/src/issues/tests/user-deleted.listener.db-spec.ts` — new.
