# `user.deleted` cleanup listener

`IssuesEventsListener.onUserDeleted({ userId })`, decorated with `@OnEvent(USER_DELETED)`, modelled on `RepositoriesEventsListener.onUserDeleted`. One transaction, in the `model.md#cleanup` lock order:

1. Lock the user's projects (`SELECT id FROM issues_projects WHERE user_id = ? FOR UPDATE`), soft-deleted ones included.
2. Lock their issues, then the links (by `user_id`), then the markers (through the links), in that order.
3. Delete the markers whose `link_id` is in the user's links.
4. Delete the links by `user_id`.
5. Delete the issues whose `project_id` is in the user's projects.
6. Delete every project of the user, live and soft-deleted.

Every statement is scoped to the user. On failure, catch the error and log at error level `issues user.deleted cleanup failed` with `{ context: 'IssuesEventsListener', userId, errorClass }` only. Never rethrow, so the user deletion always stands (E31, E53). No content, name or token goes into the log.

Do not add an `integration.deleted` hook (`model.md#cleanup`).

## Files to Change
- `backend/src/issues/issues-events.listener.ts` — new.
