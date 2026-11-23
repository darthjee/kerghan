# Bulk state service

Add `IssuesService.bulkState(userId, projectUuid, input)`, or a small `IssueBulkState` collaborator that the service delegates to. Follow the order of `api/issues.md#bulk-close-and-reopen` exactly:

1. Call `limiter.consume(userId, input.issueIds.length)`. If it is refused, throw `issueEditRateLimited(seconds)`. This happens before any database work, so nothing is applied (E74).
2. Run the access check: `access.findLiveProject(userId, projectUuid)` answers `404` for a missing, foreign or deleted project.
3. Open one transaction:
   - Lock the project row with `findLiveProject(..., manager, { lock: true })`. If it is gone, roll back and answer `404` (E67).
   - Add `IssueStore.lockManyInProject(manager, projectId, uuids)`: one `SELECT … WHERE project_id = ? AND uuid IN (?) ORDER BY id FOR UPDATE`. The ids it does not return go to `notFound` (E66).
   - Flip `state` on each issue whose state differs from the target, with one `Clock` read for `updated_at`. Issues already in the target state go to `unchanged` and get no write (E12).
   - Add `IssueMarkers.upsertForBulk(manager, issueIds, now)`. It loads the links of the changed issues in one query, locked in id order, and upserts the marker of each `linked`/`sync_failed` link (the same SQL as `upsertForEdit`). It returns those link ids. `gone` links get no marker (E72).
4. After the commit, call `syncTrigger.afterCommit(linkIds)` once, wrapped in the same try and log as `#afterCommit`. A rollback enqueues nothing.
5. Build `{ state, changed, unchanged, notFound }` in request order, as ids only.

Calls where every id is unchanged or not found still answer `200`, write nothing, and still consume their weight (E70). A database error rolls the whole call back (`500`).

## Files to Change

- `backend/src/issues/issues.service.ts` (or a new `backend/src/issues/issue-bulk-state.ts` registered in `issues.module.ts`): the flow
- `backend/src/issues/issue-store.ts`: `lockManyInProject`, and a batch state update
- `backend/src/issues/issue-markers.ts`: `upsertForBulk`
- `backend/src/issues/issue-response.ts`: `bulkStateResponse`
- `backend/src/issues/tests/issues.service.bulk-state.db-spec.ts`: new. It covers the outcomes, the request order, lowercasing, markers only for `linked`/`sync_failed` links, one T1 per changed syncing link after the commit, nothing enqueued on rollback, and the lock order.
