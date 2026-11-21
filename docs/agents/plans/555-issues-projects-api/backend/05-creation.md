# Project creation (both paths)

`ProjectsService.create(userId, input, mode)` is the one service method for both routes (`projects.md#creation-paths`). `mode` is `explicit` or `shortcut`, and the result is `{ status: 200 | 201, project }`. The order of checks is that of `api/projects.md#project-creation`.

1. DTO validation has already run in the controller.
2. If `repository` is given, call `RepositoriesService.resolveForProject`:
   - `null` answers `404 Repository not found`;
   - `added: false` answers `409 PROJECT_REPOSITORY_NOT_ADDED`.
3. If a repository is set, look for a live project of the user on it (`deleted_token = 0`):
   - explicit: `409 PROJECT_REPOSITORY_TAKEN` with `meta.projectId`;
   - shortcut: `200` with that project, ignoring `name` and `description`, and an indexed `COUNT` for `openIssueCount`. The cap is never checked on this path.
4. The name is `input.name`, or on the shortcut the default `summary.fullName`. A live project with the same name, compared case-insensitively, answers `409 PROJECT_NAME_TAKEN`. The column collation `utf8mb4_0900_ai_ci` already compares case-insensitively, and the unique index enforces it.
5. One transaction:
   - Lock the user row exclusively. Add `AccountHandleService.lockExistingUserForUpdate(userId, manager)` in Auth (`pessimistic_write`), since the existing `FOR SHARE` lock does not serialize two creations.
   - Count the live projects. At `maxProjectsPerUser` or more, answer `409 PROJECTS_LIMIT_REACHED`.
   - Insert with `uuid = randomUUID()`, timestamps from the `Clock`, `deleted_token = 0`.
   - A missing user row answers the project `404` path the module already uses for a deleted user.
6. **Races:** catch `ER_DUP_ENTRY` on insert and map it by index name:
   - `idx_issues_projects_user_id_name_deleted_token` answers `PROJECT_NAME_TAKEN`;
   - `idx_issues_projects_user_id_repository_id_deleted_token` answers `PROJECT_REPOSITORY_TAKEN` (re-read the winner for `meta.projectId`) on the explicit path. On the shortcut it re-reads the winner and answers `200`.

   Reuse the duplicate-entry detection style of `auth/default-user.service.ts`.
7. No GitHub call and no job, on either path. The constructor has no GitHub or queue dependency at all.

## Files to Change
- `backend/src/issues/projects.service.ts` — `create` and shared private helpers (new).
- `backend/src/issues/project-store.ts` — the TypeORM reads and writes for `issues_projects` (find live by name or repository, count live, insert), if the service grows too large (new).
- `backend/src/auth/account-handle.service.ts` — `lockExistingUserForUpdate`.
- `backend/src/auth/tests/account-handle.service*.spec.ts` — cover the new method.
- `backend/src/issues/tests/projects.service.create.db-spec.ts` — every outcome of the check order, the cap boundary and env override, and reuse of a name or repository after deletion (new).
- `docs/agents/specs/issues/security.md` — only if its wording names the shared lock, to say an exclusive user-row lock.
