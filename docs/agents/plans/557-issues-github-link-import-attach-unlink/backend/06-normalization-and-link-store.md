# Normalization, link store and unlink cleanup

## Normalization (`issues/github-values.ts`)

One function, `githubValues(issue)`, returns `{ title, body, state }`:

- the title and the state are verbatim;
- the body goes through the existing `normalizeBody`, so `''` and `null` become `NULL`.

It produces the local values on import, the replacement values on attach, the base snapshot, and the operands of the "values differ" test. That makes the normalization invariant structural.

`differencesOf(issue, values)` returns the ordered list of differing fields out of `title`, `body` and `state`. It compares the bodies through `normalizeBody`, so `NULL` equals `''` (`sync.md#fields-and-ownership`). No other normalization is applied: no trimming and no case folding.

## Link store (`issues/issue-link-store.ts`)

- `findByIssue(manager, issueId, { lock })` returns the link row or `null`. `lock` takes `FOR UPDATE`, which is the third step of the lock order.
- `findByGithubIssue(manager, userId, githubIssueId)` returns the existing link of this user, joined to its issue and project uuids, for the `GITHUB_ISSUE_ALREADY_LINKED` meta.
- `insert(manager, row)` writes `user_id`, `issue_id`, `github_issue_id`, `github_number`, `status: 'linked'`, `status_reason: null`, the base snapshot, `github_updated_at`, `etag`, `last_synced_at`, `created_at` and `updated_at`.
- `delete(manager, linkId)`.

## Marker

Add `IssueMarkers.lockAndDeleteForLink(manager, linkId)`. It locks the marker `FOR UPDATE` (the fourth step of the lock order), deletes it, and returns whether one existed.

The `user_id` of the link is the project owner's, for uniqueness only. It is never used as an access check.

## Files to Change
- `backend/src/issues/github-values.ts`, `issue-link-store.ts`: new.
- `backend/src/issues/issue-markers.ts`: `lockAndDeleteForLink`.
- `backend/src/issues/tests/github-values.spec.ts`: verbatim title, a blank body becoming `NULL`, `NULL` equal to `''`, whitespace kept, the order of the differences.
