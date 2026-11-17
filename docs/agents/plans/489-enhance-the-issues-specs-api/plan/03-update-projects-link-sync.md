# Update projects.md, github-link.md and sync.md

**projects.md**

- The line "Routes, payloads and error codes stay with #489" points to `api.md`.
- Creation paths: a repository row of the caller that is not added answers `409 PROJECT_REPOSITORY_NOT_ADDED` on both paths; only another user's or a missing row is hidden behind the same `404` as Add. Adjust the matching Required tests bullet.
- Name the codes where the file says `409`: `PROJECT_NAME_TAKEN`, `PROJECT_REPOSITORY_TAKEN` (with `meta.projectId`), `PROJECT_HAS_LINKS` (with `meta.linkCount`). Deletion answers `unsentIssueCount`.

**github-link.md**

- Close the "(#489)" open question and replace "the code is #489's" / "the route shape is #489's" with the decided routes and codes (import, attach with `confirmUpdatedAt`, unlink with `discardUnsentChanges`, `ISSUE_NOT_LINKED`, `ISSUE_ATTACH_CONFIRMATION_REQUIRED`, `422 GITHUB_ISSUE_IS_PULL_REQUEST`, the E57 to E60 mapping), linking to `api.md`.
- Note that `issues.updated_at` is `datetime(3)` so an edit in the same second as the warning is caught (E61).

**sync.md**

- Close the "(#489)" open question; T2 to T4 and `lastSyncedAt`/`stale` link to `api.md`.
- Retry sync: add the exception that the retry is refused with `409 PROJECT_REPOSITORY_UNAVAILABLE` before the reset while the repository is Unavailable, so the failure reason is kept. Add it to the "Left by" list and to Required tests.
- "Already fresh" names its shape (`200` with `alreadyFresh: true`).

## Files to Change

- `docs/agents/specs/issues/projects.md` — not-added refusal, codes, link to `api.md`.
- `docs/agents/specs/issues/github-link.md` — routes and codes, open question closed.
- `docs/agents/specs/issues/sync.md` — retry exception, open question closed.
