# Issue types and results

Add the typed shapes of the three operations next to the repo results. They are part of the export surface: no credential, token, `secret_iv`, URL or GitHub body ever appears in them.

Create `backend/src/integrations/github-issue-results.ts` with:

- `GithubIssueRepo`: `{ githubId: number; owner: string; name: string }`, the repository row's id and names.
- `GithubIssue`: `{ id: number; number: number; title: string; body: string | null; state: 'open' | 'closed'; updatedAt: Date; isPullRequest: boolean }`.
  - `body` is verbatim, except that a missing or blank body is `null` (the normalization invariant of `sync.md`).
  - `isPullRequest` is `true` when GitHub's object has a `pull_request` member.
- `GithubIssueChanges`: `{ title?: string; body?: string | null; state?: 'open' | 'closed' }`.
- `RenamedTo`: `{ owner: string; name: string }`.
- `IssueFailure`: `{ kind: 'not_found' } | { kind: 'gone' } | { kind: 'moved' } | { kind: 'forbidden' }`.
- `IssueResult`: `{ kind: 'ok'; issue: GithubIssue; etag: string | null; renamedTo?: RenamedTo } | { kind: 'not_modified' } | IssueFailure | RepoFailure`.
- `IssueUpdateResult`: `{ kind: 'ok'; issue: GithubIssue; renamedTo?: RenamedTo } | IssueFailure | RepoFailure`.
- `IssueProbeResult`: `{ kind: 'ok' } | { kind: 'not_found' } | { kind: 'forbidden' } | RepoFailure`.

`RepoFailure` and `UnavailableReason` are reused unchanged. `unavailable{redirect}` is the outcome of an unclassifiable `Location` or a second `301`.

Extend `RepoOperation` in `github-repo-response.ts` (or add an `IssueOperation` union beside it) with `'issue'`, `'issue_probe'` and `'issue_update'`, so classification and logs can tell them apart.

Re-export all the new types from `integrations-github.public.ts`. The services are re-exported in step 06.

## Files to Change
- `backend/src/integrations/github-issue-results.ts` — new: the issue shapes and result unions.
- `backend/src/integrations/github-repo-response.ts` — the operation union gains the issue operations.
- `backend/src/integrations/integrations-github.public.ts` — re-export the new types.
