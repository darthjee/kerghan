# IssueLinksService and controller

## `IssueLinksService` (`issues/issue-links.service.ts`)

### `link(userId, projectUuid, target, number, confirmUpdatedAt?)`

This is the one method behind import (`target = { kind: 'import' }`) and attach (`target = { kind: 'attach', issueUuid }`). The check order is exactly that of `api/github-link.md#order-of-checks-import-and-attach`:

1. `IssueLinkRateLimiter.consume(userId)`. When refused, answer `issueLinkRateLimited(ceil(retryAfterMs / 1000))`.
2. `access.findLiveProject(userId, projectUuid)`, with no lock. On attach, also `access.findIssueInProject(project, issueUuid)`.
3. Import only: `countInProject >= maxIssuesPerProject` answers `issuesLimitReached()` (the pre-check).
4. Attach only: an existing link answers `issueAlreadyLinked()`.
5. `project.repositoryId === null` answers `projectHasNoRepository()`. Otherwise read `projectSummaries(userId, [repositoryId])`. A missing summary (dangling) or the status `unavailable` answers `projectRepositoryUnavailable()`. `unknown` is allowed. No GitHub call happens on these paths.
6. `reader.readForLink(userId, { owner, name }, repositoryId, number)`, outside any transaction. The outcomes map as follows:
   - `not_found` answers `githubIssueNotFound()`;
   - `rate_limited` answers `githubRateLimited(retryAfterSeconds)`;
   - `credential` answers `githubCredentialUnusable(reason)`;
   - `unavailable` answers `githubUnavailable()`.
7. `issue.isPullRequest` answers `githubIssueIsPullRequest()` (E3).
8. The transaction:
   1. `findLiveProject(..., manager, { lock: true })`. A project deleted in the meantime answers `404`.
   2. `project.repositoryId` differs from the id read in step 5 → `projectRepositoryChanged()` (E62).
   3. Import: check the cap again → `issuesLimitReached()`.
   4. Attach: `findIssueInProject(..., { lock: true })` (a deleted issue answers `404`), then an existing link → `issueAlreadyLinked()`.
   5. `findByGithubIssue(userId, issue.id)` → `githubIssueAlreadyLinked(projectUuid, issueUuid)` (E4).
   6. Attach: `differencesOf(local, githubValues(gh))`. When it is not empty and `confirmUpdatedAt?.getTime() !== issue.updatedAt.getTime()`, answer `issueAttachConfirmationRequired(differences, issue.updatedAt.toISOString())`. When the values are equal, any confirmation is ignored.
   7. Write.
      - Import inserts the issue with `githubValues`, a new uuid, `createdAt = stampOf(clock)` and `updatedAt = clock.now()`.
      - Attach with differences updates the title, body and state to `githubValues` with `updatedAt = clock.now()`.
      - Attach without differences writes nothing on the issue.
      - Then the link is inserted with the base equal to `githubValues`. It gets `github_issue_id = gh.id`, `github_number = gh.number`, `github_updated_at` as GitHub's `updatedAt` truncated to whole seconds, `etag`, `last_synced_at = created_at = updated_at = stampOf(clock)`, and `status: 'linked'`.

   No marker is created, nothing is written to GitHub and nothing is enqueued.
9. A unique-index race on `idx_issues_github_links_user_id_github_issue_id` (found through `duplicateEntryIndex`) re-reads the winner and answers `githubIssueAlreadyLinked` with its uuids (E46). A race on `idx_issues_github_links_issue_id` answers `issueAlreadyLinked()`.
10. The response is the issue object, with the link built by the presenter. Import answers `201` and attach `200`.

Re-checking the repository under the project lock is what closes the E62 race. `ProjectRepositoryChanger` takes the same lock first, so a change commits either before the link transaction (which then sees a different `repositoryId` and answers `PROJECT_REPOSITORY_CHANGED`) or after it (which then counts the link and answers `PROJECT_HAS_LINKS`).

### `unlink(userId, projectUuid, issueUuid, discardUnsentChanges)`

Everything runs in one transaction, in lock order, and no GitHub call or enqueue happens:

1. Lock the project, then the issue. Either one missing answers `404`.
2. `findByIssue(..., { lock: true })`. When there is no link, answer `issueNotLinked()` (E64).
3. Check whether a marker exists, under a `FOR UPDATE` read. When one exists and `discardUnsentChanges !== true`, answer `issueUnlinkHasUnsentChanges()` and change nothing (E63).
4. `lockAndDeleteForLink`, then delete the link.

This works in every link state and while the repository is Unavailable. The response is `{ issue, droppedUnsentChanges }`, with `issue.link` set to `null`.

## Controller (`issues/issue-links.controller.ts`)

A new thin controller next to `IssuesController`. It keeps the link routes and their dependencies apart; the issues controller does not grow.

- `@Post('projects/:projectId/issues/import.json')` with `@HttpCode(201)`.
- `@Post('projects/:projectId/issues/:issueId/attach.json')` with `@HttpCode(200)`.
- `@Post('projects/:projectId/issues/:issueId/unlink.json')` with `@HttpCode(200)`.

Each route has `@CachePolicy(CacheClass.UserScoped)`, `uuidParamPipe()` on both ids and the session user from the guard. Each maps its DTO to the typed input and calls exactly one service method.

Register it in `IssuesModule.controllers`. Add `IssueLinksService`, `IssueLinkRateLimiter`, `IssueCandidates`, `IssueGithubReader`, `IssueLinkStore` and the `IssueRateLimitWaits` binding to `ISSUES_PROVIDERS`. Import `IntegrationsModule` through its public entry if it is not wired already.

Update the module doc comment and `docs/agents/modules/issues.md`, if it lists the routes.

## Files to Change
- `backend/src/issues/issue-links.service.ts` and `issue-links.controller.ts`: new.
- `backend/src/issues/issues.module.ts`: the providers, the controller and the Integrations import.
- `backend/src/issues/tests/support/build-issues-test-app.ts` and the DB harnesses: wire the fake Integrations GitHub service from #554.
