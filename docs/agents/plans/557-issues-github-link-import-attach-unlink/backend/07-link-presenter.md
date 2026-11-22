# Link object presenter and waiting-set port

## Waiting-set port (`issues/issue-rate-limit-waits.ts`)

- An abstract class, `IssueRateLimitWaits`, with `untilFor(linkIds: number[]): Map<number, Date>`, the reset time of each link that is in a waiting set.
- `EmptyIssueRateLimitWaits` returns an empty map and is bound in `ISSUES_PROVIDERS`.
- The doc comment says that #558 binds the real in-memory waiting sets.

## `IssueLinkPresenter.forIssues(issueIds, manager?)`

Replace the empty map with the link object of `api/github-link.md#link-object`. It uses a constant number of queries per call, whatever the page size, and never one query per issue:

1. The links by `issue_id IN (:ids)`, joined to `issues` and `issues_projects` for the project's `user_id` and `repository_id`. Only ids already resolved through `IssuesAccess` are ever passed in.
2. Marker existence by `link_id IN (...)`.
3. The repository summaries, through `RepositoriesService.projectSummaries(userId, repositoryIds)`, once per call. On a page all issues share one project.
4. `IssueRateLimitWaits.untilFor(linkIds)`.

Each field is built as follows:

- `number` is `github_number`.
- `url` is `https://github.com/${owner}/${name}/issues/${number}`, from the summary's stored `owner` and `name`. When the repository reference dangles (no summary), `url` is `null`. Note this in the PR, because the spec does not cover it.
- `states` lists every state that applies, in precedence order:
  1. `gone` when `status = 'gone'`;
  2. `sync_failed` when `status = 'sync_failed'`;
  3. `repository_unavailable` when the summary's status is `unavailable` or the summary is missing;
  4. `rate_limited` when the link is in the waiting map;
  5. `pending` when a marker exists.

  `linked` appears alone only when none of these applies. `state` is `states[0]`.
- `reason` is `status_reason`, or `null`.
- `rateLimitedUntil` is the ISO string from the map, or `null`.
- `lastSyncedAt` is an ISO string, with second precision.
- `stale` is `false` for `gone`. Otherwise it is `now - lastSyncedAt > syncStaleAfterSeconds`, using the `Clock`.

Every field is copied explicitly, with no spread, so no internal id leaks. A read never enqueues.

Type `IssueLinkResponse` properly, replacing the `Record<string, unknown>` placeholder.

## Files to Change
- `backend/src/issues/issue-rate-limit-waits.ts`: new.
- `backend/src/issues/issue-link-presenter.ts`: the real presenter, with the response type and pure builder functions (`linkResponse`, `statesOf`) that are unit-testable.
- `backend/src/issues/issues.module.ts`: bind `IssueRateLimitWaits` to `EmptyIssueRateLimitWaits`.
- `backend/src/issues/tests/issue-link-presenter.spec.ts`:
  - each state alone;
  - the combinations, in precedence order (`sync_failed` plus `pending`, `gone` plus a marker, and so on);
  - `linked` alone;
  - `stale` at the boundary, and never for `gone`;
  - a dangling repository;
  - `rateLimitedUntil` read through a fake port.
- `issue-link-presenter.db-spec.ts`: a page of linked and unlinked issues, with the query count bounded.
