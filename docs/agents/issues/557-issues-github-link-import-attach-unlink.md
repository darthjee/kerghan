# Issue: Issues: GitHub link (import, attach, unlink)

## Description

This is part of the epic #483 (Issues and Projects). Kerghan gets **projects**, each optionally connected to one repository, and **issues** that belong to a project. An issue may be linked one to one to a GitHub issue, and background workers keep the two in sync both ways. The feature is specified in `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md`, with the lifecycle in `docs/agents/specs.md`. The specification phase is finished, and #492 spawned the implementation issues.

This issue builds the **GitHub link**: importing a GitHub issue, attaching one to an existing Kerghan issue, unlinking, and the link object returned with every issue. The specs are the source of truth. This issue makes no product decision of its own; if a decision has to change, the spec is updated in the same PR (`docs/agents/specs.md`, lifecycle step 2).

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/github-link.md`, these sections:
  - *Creating a link*
  - *Same-repository rule and repository changes*
  - *Unlinking*
  - *Link states*: the stored vocabulary, the derived states and the precedence, as read by the link object
- `docs/agents/specs/issues/api/github-link.md`:
  - import, attach and unlink, with the order of checks
  - the GitHub failures on link creation
  - the attach confirmation
  - the link object

  The trigger routes in that file belong to #558.
- `docs/agents/specs/issues/sync.md#integration-selection`: the candidates, their order, the fallback on credential failures only, and the aggregate reason. #557 uses them for its single read, and #558 reuses them.
- `docs/agents/specs/issues/security.md#request-rate-limits`: the link limit.
- `docs/agents/specs/issues/edge-cases.md`:
  - E3 and E4
  - E45 to E47
  - E57 to E64
  - E62 in full: the race between a repository change and a real link creation, whose repository-change side #555 already built

## Task

- **Routes:**
  - `POST /projects/:projectId/issues/import.json` with `{ number }`, answering `201` with the issue
  - `POST /projects/:projectId/issues/:issueId/attach.json` with `{ number, confirmUpdatedAt? }`, answering `200` with the issue
  - `POST /projects/:projectId/issues/:issueId/unlink.json` with `{ discardUnsentChanges? }`, answering `200` with `{ issue, droppedUnsentChanges }`

  Every route uses `@CachePolicy(CacheClass.UserScoped)` and `uuidParamPipe()`.
- **One service method for import and attach.** It runs the checks in the order given by `api/github-link.md`:
  1. DTO validation.
  2. The link rate limit, `429 ISSUE_LINK_RATE_LIMITED`. Import and attach share one window, and a refused call consumes nothing.
  3. The access check.
  4. Import only: the issue-cap pre-check.
  5. Attach only: the issue already has a link, `ISSUE_ALREADY_LINKED`.
  6. The project has no repository, or its repository is Unavailable or dangling (no GitHub call in either case).
  7. One `getIssue` outside any transaction.
  8. A pull request is refused with `422`.
  9. The transaction, which locks the project and then, on attach, the issue. Inside it:
     - the cap is checked again;
     - a repository changed in the meantime answers `PROJECT_REPOSITORY_CHANGED` (E62);
     - a GitHub issue already linked answers `GITHUB_ISSUE_ALREADY_LINKED` with `meta.projectId` and `meta.issueId`, including when the unique index decides the race (E4, E46);
     - on attach, a link gained in the meantime answers `ISSUE_ALREADY_LINKED`;
     - on attach, the E61 confirmation is checked.
  10. The write: a link with status `linked` and the base snapshot. Import also creates the issue.

  The normalization invariant holds: one function produces the local values, the base snapshot and the comparison operands.
- **Client outcomes on creation** (E57 to E60):
  - `not_found`, `gone` and `moved` answer `404 GITHUB_ISSUE_NOT_FOUND`;
  - `rate_limited` answers `503 GITHUB_RATE_LIMITED` with `retryAfterSeconds`;
  - no candidate, `invalid_credentials`, `forbidden` and `integration_unusable` answer `409 GITHUB_CREDENTIAL_UNUSABLE` with `meta.reason`;
  - `unavailable`, which includes an unclassifiable `301`, answers `502 GITHUB_UNAVAILABLE`.

  A failed creation stores nothing, enqueues no job and never waits.
- **Integration selection (the candidate resolver).** The candidates are the owner's usable integrations whose source lists the project's repository, read through Repositories' exported service. They are ordered by known write capability. On a credential failure only (`401`, a non-rate-limit `403`, `integration_unusable`), the read moves to the next candidate. The aggregate reason is `forbidden` if any candidate answered a `403`, otherwise `credential_invalid`, or `no_credential` when there is no candidate at all (E20).
  - The resolver is built as a service that #558 reuses.
  - #558 adds the paused-candidate skip and the waiting sets.
- **Unlink** (E63, E64): `409 ISSUE_NOT_LINKED` when there is no link. When a marker exists and `discardUnsentChanges` is not `true`, the answer is `409 ISSUE_UNLINK_HAS_UNSENT_CHANGES`. Otherwise, in one transaction in lock order (project, issue, link, marker), the link and its marker are deleted. Unlink works in every link state, never calls GitHub and never enqueues.
- **The link object**, filling the `IssueLinkPresenter` seam left by #556:
  - fields: `number`, `url` (from the repository's stored owner and name), `state`, `states` (in precedence order), `reason`, `rateLimitedUntil`, `lastSyncedAt` and `stale` (from `syncStaleAfterSeconds`, never true for `gone`);
  - loaded once per page with no per-issue queries;
  - a read never enqueues.
- **New error codes and helpers**, in `issues-http-errors.ts`, plus `error.meta` where the catalogue gives one:
  - `ISSUE_LINK_RATE_LIMITED`
  - `GITHUB_ISSUE_NOT_FOUND`
  - `PROJECT_HAS_NO_REPOSITORY`
  - `PROJECT_REPOSITORY_UNAVAILABLE`
  - `PROJECT_REPOSITORY_CHANGED`
  - `GITHUB_ISSUE_ALREADY_LINKED`
  - `ISSUE_ALREADY_LINKED`
  - `ISSUE_ATTACH_CONFIRMATION_REQUIRED`
  - `ISSUE_NOT_LINKED`
  - `ISSUE_UNLINK_HAS_UNSENT_CHANGES`
  - `GITHUB_CREDENTIAL_UNUSABLE`
  - `GITHUB_ISSUE_IS_PULL_REQUEST`

## Scope

- **Waiting-set port.** The `rate_limited` state and `rateLimitedUntil` are read through a port whose default binding is empty. Until #558 binds the real in-memory waiting sets, every link reads `rateLimitedUntil: null` and never `rate_limited`. This mirrors the T1 sync-trigger seam of #556.
- **Rename hint.** A `renamedTo` hint returned during link creation is not acted on here: no Repositories hook exists yet. The hand-off to Repositories belongs to #558.
- **`ISSUE_LINKED` on delete.** #556 already built it. #557 only checks it again against real links.
- **Out of scope, owned by #558:**
  - the gone, moved and `sync_failed` transitions on refresh and push
  - the E22 probe
  - the E1 race between an edit and the job that sets `gone`
  - the E44 in-flight push
  - the rename hand-off (E65)
  - the trigger routes (T2 to T4)
  - the paused-candidate skip and the waiting sets
- **Out of scope, owned by #554:** the client itself (`getIssue`, `probeIssues`, the writer, the redirect rule) and its fake and contract specs.
- **Out of scope, owned by others:** bulk import (not in v1), the #559 test matrix and the UI.

## Depends on

- #554 (Issues: GitHub issue client in Integrations): **still open**. #557 is refined and planned against the client contract in `sync.md#github-issue-client-operations`, and its implementation starts only after #554 merges.
- #556 (Issues: issues API): merged.

## Acceptance criteria

- The Required tests of the spec sections listed under *Builds against* are implemented, limited to this issue's scope. Each one uses the tier given by [`testing.md`](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs/issues/testing.md).
- The attach stale confirmation is tested within the same second (`datetime(3)`, with `FakeClock`).
- These races are tested at the `(db)` tier:
  - the attach/delete race;
  - the full E62 race between a repository change and a link creation;
  - the unique-index races of E4 and E46.
- Two users can link the same GitHub issue (E45). Deleting a project frees its GitHub issues so they can be linked again from another project (E47), and unlinking frees the GitHub issue for this user in the same way.
- The integration selection is covered: candidates, order, the credential-only fallback, the aggregate reason, and handle-only counting as no candidate.
- No decision differs from the specs. If one has to, the spec is updated in the same PR.
- The owning agent's checks pass.

## Notes

Responsible agent: `backend`.
- Routes: ask the `cache` agent for the cache-class review (`@CachePolicy(CacheClass.UserScoped)`, `X-Skip-Cache`, nothing in Navi). Ask the `security` and `data-access` agents for the checklists in `docs/agents/specs/issues/security.md#review-checklist`.
- Lock order: projects, issues, links, markers. The GitHub read happens before the transaction, and no lock is held across the network call.
