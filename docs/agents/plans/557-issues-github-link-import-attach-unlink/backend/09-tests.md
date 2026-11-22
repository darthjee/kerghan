# Tests

The tiers follow `docs/agents/specs/issues/testing.md`: e2e with fakes for the answers, `(db)` for the unique indexes, locks and races, and unit tests for the pure mapping. The fake GitHub client and the builders come from #554.

## e2e with fakes (`issues/tests/`)

- **`issue-links.controller.access.e2e-spec.ts`:**
  - no session answers `401`;
  - a foreign origin answers `403`;
  - another user's project or a deleted project answers `404 Project not found` on all three routes, with no GitHub call;
  - an issue in another project answers `404 Issue not found`;
  - a non-uuid id answers `400`.
- **`issue-links.controller.validation.e2e-spec.ts`:** the DTO cases. Each answers `400` before any lookup or GitHub call.

## DB tier (`issues/tests/*.db-spec.ts`, with the fake GitHub client)

- **`issue-links.import.db-spec.ts`:**
  - import creates the issue with GitHub's values, including a closed issue stored as `closed`, and the link answers `linked`;
  - the base equals the local columns (the normalization invariant);
  - a blank body is stored as `NULL`;
  - no marker and no job, and the call log holds exactly one `getIssue` in the project's repository with the given number;
  - the cap is enforced both as the pre-check (no GitHub call) and under the lock.
- **`issue-links.attach.db-spec.ts`:**
  - equal values link at once, with no confirmation and no issue write;
  - differing values without `confirmUpdatedAt` answer `409 ISSUE_ATTACH_CONFIRMATION_REQUIRED` with `differences` and `updatedAt`, and change nothing;
  - the current `updatedAt` replaces the values, the base equals local, and no marker and no GitHub write follow;
  - a stale value changes nothing. This includes an edit made **in the same second** as the warning, using `FakeClock` with a millisecond step (`datetime(3)`);
  - a confirmation sent while the values are equal is ignored;
  - an already-linked issue answers `ISSUE_ALREADY_LINKED` (E64).
- **`issue-links.refusals.db-spec.ts`:**
  - no repository answers `PROJECT_HAS_NO_REPOSITORY`, an Unavailable or dangling repository answers `PROJECT_REPOSITORY_UNAVAILABLE`, both with no GitHub call, while Unknown is allowed;
  - a pull request answers `422` on import and attach (E3);
  - E57: not found, `gone` and `moved` all answer `404 GITHUB_ISSUE_NOT_FOUND`;
  - E58: a rate limit answers `503` with `retryAfterSeconds` and `Retry-After`;
  - E59: no candidate, `401`, `403` and handle-only answer `409 GITHUB_CREDENTIAL_UNUSABLE` with the right `meta.reason`;
  - E60: timeout, `5xx` and an unclassifiable `301` answer `502`;
  - each of these leaves the issue, link and marker tables unchanged, enqueues no job and makes no wait;
  - the link rate limit answers `429 ISSUE_LINK_RATE_LIMITED` before the access check, import and attach share the window, and a refused call consumes nothing.
- **`issue-links.duplicates.db-spec.ts`:**
  - a GitHub issue already linked by this user answers `409 GITHUB_ISSUE_ALREADY_LINKED` with the existing `projectId` and `issueId` (E4);
  - two users can link the same GitHub issue (E45);
  - after deleting a project, its GitHub issue can be linked again from another project (E47).
- **`issue-links.unlink.db-spec.ts`:**
  - unlink deletes the link and its marker, keeps the issue unchanged, makes no GitHub call and answers `link: null`;
  - the GitHub issue is freed and can be attached again, in this project or another;
  - with a marker and no flag the answer is `ISSUE_UNLINK_HAS_UNSENT_CHANGES` and the link and marker stay; with the flag both are deleted and the response says `droppedUnsentChanges: true` (E63);
  - unlink works for `gone`, `sync_failed` and an Unavailable repository;
  - a repeat unlink answers `ISSUE_NOT_LINKED` (E64).
- **`issue-links.presenter`, through show and listing:**
  - the link object on show and on the listing;
  - delete of a linked issue answers `409 ISSUE_LINKED` with a real link, and succeeds after an unlink.
- **`issue-links.routes.db-spec.ts`:** the three routes declare `user-scoped`, as in `issues.routes.db-spec.ts`.

## Races (`issues/tests/races/`, `(db)`, with deferred fake answers)

- **`link-unique.race.db-spec.ts`:**
  - two concurrent imports of one GitHub issue: one wins and the other answers `GITHUB_ISSUE_ALREADY_LINKED` (E46);
  - two attaches of different GitHub issues to one Kerghan issue: one wins and the other answers `ISSUE_ALREADY_LINKED`.
- **`link-repository-change.race.db-spec.ts` (the full E62):** hold the GitHub read with a deferred answer, change the repository, then release the read. The link answers `PROJECT_REPOSITORY_CHANGED` and no link exists. In the reverse order the change answers `PROJECT_HAS_LINKS`. The race never leaves a link against a changed repository.
- **`attach-delete.race.db-spec.ts`:** an attach whose read is held while the issue is deleted answers `404` and leaves no link. A delete that waits on the attach's issue lock answers `ISSUE_LINKED`.

## Boundaries

- Extend `module-boundaries.spec.ts` and `eslint-boundary.spec.ts`, if needed, so the new files import Integrations only through `integrations-github.public`.
- Drop `issues.no-github.spec.ts`'s claim for the module, or narrow it to the files that still make no GitHub call. Document the change.
- `column-allowlist.spec.ts` covers the link object's fields.
