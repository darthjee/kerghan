# IssuesService

`issues.service.ts` holds the issue business logic, with typed inputs and the wire shapes as outputs. Every method starts from `IssuesAccess`. It never calls GitHub (it has no GitHub dependency) and never enqueues anything itself, only through the `IssueSyncTrigger` port.

## `list(userId, projectUuid, input)`

1. Run `access.findLiveProject(userId, projectUuid)`.
2. Run `store.page(project.id, input)`.
3. Run `linkPresenter.forIssues(ids)` once for the page.
4. Return `{ issues, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } }`.

It makes no write and enqueues nothing.

## `create(userId, projectUuid, input)`

All of it runs in one transaction:

1. Run `access.findLiveProject(userId, projectUuid, manager, { lock: true })`. This is the project row lock that serializes creations.
2. If `store.countInProject(manager, project.id) >= config.maxIssuesPerProject`, throw `issuesLimitReached()`.
3. Insert the issue:
   - `uuid` from `randomUUID()`;
   - `title`, `body` (already normalized), and `state` (default `open`);
   - `createdAt = stampOf(clock)`, and `updatedAt` = the full-millisecond `clock.now()`.
4. Return the issue object with `link: null`. Create makes an unlinked issue, so the presenter is still called for uniformity.

The route answers `201`. Nothing is enqueued.

## `show(userId, projectUuid, issueUuid)`

Run `findLiveProject`, then `findIssueInProject`. Return the object with `body` and its link from the presenter.

## `edit(userId, projectUuid, issueUuid, input)`

1. **Rate limit first:** run `limiter.consume(userId, 1)`. If it is refused, throw `issueEditRateLimited(ceil(retryAfterMs / 1000))`. This happens before any lookup, and the DTO already validated the body.
2. In one transaction:
   1. Run `findLiveProject(userId, projectUuid, manager)` **without** a lock. The single edit takes no project lock.
   2. Run `findIssueInProject(project, issueUuid, manager, { lock: true })`.
   3. Compute `changes` against the stored values. An absent field is ignored. Equal values are dropped (`body` is compared after `normalizeBody`).
   4. If there are no changes, return the stored issue: no write, no marker, no revision bump, `updated_at` unchanged (E12).
   5. Otherwise, run `store.update(manager, issue.id, changes, clock.now())`, then `markers.upsertForEdit(manager, issue.id, stampOf(clock))`.
3. After the commit, if a link id came back, call `syncTrigger.afterCommit([linkId])`, guarded as in step 05.
4. Return the object as stored after the edit, with the link from the presenter.
   - Today the link is `null`. Once #557 fills in the presenter, it reflects the derived *pending* state, because the presenter is read after the commit.

## `delete(userId, projectUuid, issueUuid)`

All of it runs in one transaction:

1. Run `findLiveProject(..., manager, { lock: true })` (project row first, so a concurrent attach is serialized).
2. Run `findIssueInProject(..., manager, { lock: true })`.
3. If `markers.hasLink(manager, issue.id)`, throw `issueLinked()`.
4. Run `store.delete(manager, issue.id)`.

It answers `{}`, never touches GitHub, and a second delete answers `404`.

## Files to Change

- `backend/src/issues/issues.service.ts` — the service.
