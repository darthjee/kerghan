# Issue: Enhance the Issues specs: API

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is first defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`). This issue is documentation only: no code, migrations or endpoints.

Enhance `docs/agents/specs/issues/api.md` (created by the first sub-issue of the epic): resolve its open questions, fill gaps and make it precise enough for an implementation issue to build against without making its own decisions.

Focus:
- Routes, methods, payloads and responses for projects, issues, the GitHub link and triggering a sync.
- Error codes and statuses, including 404 for another user's project or issue.
- Pagination, filtering and sorting of issue lists.
- Validation rules.
- How sync state and sync errors are exposed to the client.
- Alignment with the existing route docs under `docs/agents/backend/routes/` and with the cache classes (`@CachePolicy`) and the `X-Skip-Cache` rules.

Keep the other spec files consistent: when a decision here changes another file, update it in the same PR. Specs describe decisions, not code, and the file must keep its "Required tests" section up to date.

Responsible agent: `architect`. Builds on the model, link and sync specs.

## Problem

`docs/agents/specs/issues/api.md` holds principles only: routes, payloads, error codes, pagination, validation, how sync state is exposed and cache classes are all open questions owned by #489, and several other spec files (`projects.md`, `github-link.md`, `sync.md`, `model.md`, `edge-cases.md`) defer their refusal codes, confirmations, the issues listing sort and single-issue deletion to it. An implementation issue cannot build the API without making those decisions itself.

## Expected Behavior

- `api.md` has no unresolved open questions, or lists any that remain with the reason and the issue that will settle them.
- The "Required tests" section matches the rules in the file.
- Related spec files are consistent with it.
- No code, migrations or endpoints are added.

### Scope boundaries

**In scope (this issue, documentation only):**

- Rewrite `docs/agents/specs/issues/api.md` with every decision above: route conventions, identifiers, the project, issue, link and trigger routes, the link object, the error catalogue, input validation and its "Required tests". Its open questions are closed or moved to their owner.
- Consistency edits to the other spec files in the same PR:
  - `model.md`: `uuid` columns and unique indexes on `issues_projects` and `issues`; the issue reference is the uuid; `issues.updated_at` is `datetime(3)`; the listing index becomes (`project_id`, `state`, `created_at`); single-issue deletion is the issue only and is refused while linked; the "#489 decides" mentions are resolved.
  - `projects.md`: a not-added repository answers `409` on both creation paths (only another user's or a missing row is hidden behind `404`); point the "routes stay with #489" line to `api.md`.
  - `github-link.md` and `sync.md`: close the #489 open questions and point to `api.md`; `sync.md`'s retry gains the "refused while the repository is Unavailable" exception.
  - `edge-cases.md`: the E3, E4, E46, E57 to E64 rows and the E18 recovery path name their route and code.
  - `testing.md` and `security.md`: the route access matrix lists the Issues routes; anything else is settled in the testing topic.
  - `ui.md`: no decision moves; inputs for #491 are added (`alreadyFresh`, the attach `409` as the warning, `ISSUE_NOT_LINKED` treated as done).
  - `issues.md`: the index marks `api.md` decided.

**Out of scope:**

- Code, migrations, DTOs, `ErrorCodes` and endpoints (implementation is spawned by #492).
- Permanent docs that describe today's code: `architecture/backend.md` (`error.meta`), `backend/routes/` (a `routes/issues.md` is written at fold time from `api.md`), `environment-variables.md`, Navi config (no route is warmed).
- Wording, screens and polling cadence after a trigger (#491).
- Rendering of GitHub content, encryption, retention, quotas and request rate limits on creation routes (#490).
- Bulk import, issue search across projects, a GitHub issue picker or listing for import, labels and other synced fields, sharing (out of the epic or deferred).

## Solution

Rewrite `api.md` with the decisions below (settled in the enhancement dialogue), and apply the consistency edits listed under Scope boundaries in the same PR.

### Decisions already made in the epic

- A project is the home of issues; every Kerghan issue belongs to exactly one project. A project may be about code or anything else.
- Project to repository: 0 or 1 linked repository (one of the user's repository rows). A project with no repository is a non-code project. Whether one repository may back several projects of the same user is open.
- Ownership: one user, private (another user's project answers 404). Sharing, members and roles are out of scope, but the spec must not make them impossible later.
- Creation: explicit (optionally picking an added repository, the only way to make a non-code project), plus a shortcut that creates a project from an added repository.
- Issue to GitHub issue: one to one, per user (unique on user and GitHub issue); the link is optional; it can be created from a GitHub issue or by attaching one to an existing Kerghan issue; the GitHub issue must belong to the project's linked repository.
- Sync is two-way; the details (fields, conflict rules, states) are decided in the enhancement issues.
- Workers (from #479, in-process, in-memory queues): on-demand triggers only; outbound writes use a durable pending marker in the database that is re-enqueued at boot; rate limits reuse `retryAfterSeconds` with retry and cooldown, and exhausted retries mark the link as sync failed; jobs receive ids only, and credentials stay in the Integrations module.
- `product.md` says issue data is not persisted by default; this epic changes that and the specs must say what is now stored.

### Route conventions (decided)

Copied from [`routes/repositories.md`](../backend/routes/repositories.md#every-route) unless stated:

- **Every route is `POST` and ends in `.json`, reads included.** Tent's cache key ignores the method, so a user-scoped `GET` risks being cached for everyone. No Issues route answers `GET`.
- **Actions are verb suffixes**, single reads included (`…/show.json`, `…/edit.json`, `…/delete.json`, `…/unlink.json`), as Auth, Sessions and Admin already do. There is no `PATCH`/`DELETE`, so the unlink confirmation never travels in a `DELETE` body. A bare `/:id.json` read is avoided because it would collide with `/projects/mine.json`.
- **Ids in the path.** Projects and issues are named by their public uuid in the path (no dot clash, unlike repository names); see [Exposed identifiers](#exposed-identifiers-decided). The body carries only the payload.
- **Issue routes are fully nested under their project:** `/projects/:projectId/issues/:issueId/...`. The service looks the issue up **within** the path's project through the single access check. An issue of another project, or of another user's or a deleted project, answers the same `404` as a missing one.
- **Malformed path ids** (not a uuid, checked with `ParseUUIDPipe` as Sessions does) answer `400 VALIDATION_FAILED`. Well-formed ids that do not resolve answer `404`.
- **Auth, CSRF and cache:** global `JwtGuard` (no `@Public()`, no `@AdminOnly()`), the caller from `req.user.sub`; `OriginGuard` covers every route; cache class `user-scoped` (`@CachePolicy(CacheClass.UserScoped)`), so every response that passes the guards (successes and handler errors) sends `X-Skip-Cache: true` and `Cache-Control: no-store`. Navi warms nothing.
- **Bodies** go through the global `ValidationPipe({ whitelist: true, transform: true })`: unknown properties are stripped and ignored.
- **Errors** use the standard error shape (`core/http-exception.filter.ts`), with `retryAfterSeconds` in both the body and `Retry-After` when there is a delay.
- **Admins** have no access to anyone's projects or issues.
- Controllers stay thin: validation in DTOs, everything else in the `issues` module's services.

Route shape (exact list settled in the project, issue, link and sync topics):

```text
POST /projects/mine.json
POST /projects/create.json
POST /projects/from-repository.json
POST /projects/:projectId/show.json
POST /projects/:projectId/edit.json
POST /projects/:projectId/repository.json
POST /projects/:projectId/delete.json
POST /projects/:projectId/refresh.json
POST /projects/:projectId/issues.json
POST /projects/:projectId/issues/create.json
POST /projects/:projectId/issues/import.json
POST /projects/:projectId/issues/:issueId/show.json
POST /projects/:projectId/issues/:issueId/edit.json
POST /projects/:projectId/issues/:issueId/delete.json
POST /projects/:projectId/issues/:issueId/attach.json
POST /projects/:projectId/issues/:issueId/unlink.json
POST /projects/:projectId/issues/:issueId/refresh.json
POST /projects/:projectId/issues/:issueId/retry-sync.json
```

### Exposed identifiers (decided)

- **Projects and issues expose a uuid, never their internal `int` id**, following Integrations and Sessions. `issues_projects` and `issues` each gain a `uuid` column (`char(36)`, generated by the application with `randomUUID()` at insert, unique indexes `idx_issues_projects_uuid` and `idx_issues_uuid`). The API calls it `id`, as Integrations does. `model.md` gets the columns and indexes in the same PR, and its "the `id` is the issue's reference" wording changes to the uuid.
- The internal ids stay internal: foreign keys, job params (`{ linkId }`), logs and locks keep using them. Sequential ids would leak the global creation rate and break the codebase's "no internal id in responses" rule.
- No human-friendly issue reference (per-project number) in v1, unchanged from `model.md`.
- **A repository is named by the existing repo ref** of [`routes/repositories.md`](../backend/routes/repositories.md#repo-ref), as that file already promises for future per-repo routes: exactly one of `{ githubId }` or `{ fullName }` with the same validation (`400` on both or neither, or malformed), resolved case-insensitively among the caller's own rows with the same `fullName` tie-break. Used by explicit create, the shortcut and attach/change. A ref not among the caller's rows answers `404`, like Add. A row that exists but is not added answers the refusal decided in the project topic, so a rejected ref never reveals more than Add does.
- **Responses never contain:** the internal `id` of a project, issue, repository, link or marker; any `user_id`; an internal `integrations.id` or any integration field (the "rate limited until X" state carries only the time); credential material.
- **Repository summary in project responses:** `githubId`, `owner`, `name`, `fullName`, `private` and `status` (`added`, `unavailable`, `unknown`), the same names as the Repositories listing row. A dangling reference reads `unavailable` with the snapshot fields `null`.
- **GitHub side of a link:** its `number` and a `url` built from the repository's stored `owner`/`name` and the number. GitHub's global issue id is not exposed in v1 (no consumer needs it).

### Project routes (decided)

| Action | Route | Body | Success |
|---|---|---|---|
| Listing | `POST /projects/mine.json` | `{ page, perPage, search }` | `200` `{ projects, pagination }` |
| Explicit create | `POST /projects/create.json` | `{ name, description?, repository? }` | `201` project |
| Shortcut | `POST /projects/from-repository.json` | `{ repository, name?, description? }` | `201` new project, `200` existing one |
| Show | `POST /projects/:projectId/show.json` | none | `200` project |
| Edit | `POST /projects/:projectId/edit.json` | `{ name?, description? }` | `200` project |
| Repository | `POST /projects/:projectId/repository.json` | `{ repository: <repo ref> \| null }` | `200` project |
| Delete | `POST /projects/:projectId/delete.json` | none | `200` `{ unsentIssueCount }` |

`repository` is always the [repo ref](#exposed-identifiers-decided). Both creation routes call the one service method of [projects.md](../specs/issues/projects.md#creation-paths).

#### Project object

```json
{
  "id": "3f2a…c9",
  "name": "Kerghan",
  "description": null,
  "repository": {
    "githubId": 123456, "owner": "darthjee", "name": "kerghan",
    "fullName": "darthjee/kerghan", "private": false, "status": "added"
  },
  "createdAt": "2026-11-17T12:00:00Z",
  "updatedAt": "2026-11-17T12:00:00Z"
}
```

- `repository` is `null` for a non-code project. `status` is `added`, `unavailable` or `unknown`; a dangling reference reads `unavailable` with the snapshot fields `null`.
- No issue counts or sync info in v1 ([projects.md](../specs/issues/projects.md#fields)).
- The same object is returned by every route above except delete, and is the listing row.

#### Listing

- `page` integer ≥ 1 (default 1; past the end answers `200` with an empty list); `perPage` integer 1 to 100 (default 50); `search` trimmed, at most 100 characters, case-insensitive literal substring of the name, with `%`, `_` and `\` escaped, as in the Repositories listing. Invalid values answer `400 VALIDATION_FAILED`.
- Live projects only. Sort: name, case-insensitive (stable, since names are unique among live projects), served by the unique (`user_id`, `name`, `deleted_token`) index; no sort parameter.
- `pagination` is `{ page, perPage, total, totalPages }`, counting the rows that match `search`.

#### Creation

Checks in order, for both routes:

1. DTO validation (`400`); `repository` is required on the shortcut.
2. The ref is resolved among the caller's own repository rows; not found answers `404 NOT_FOUND` (`Repository not found`, the same message as Add), so another user's or a missing row is indistinguishable.
3. A row that is not added answers `409 PROJECT_REPOSITORY_NOT_ADDED` on both routes; the shortcut never adds one. This reveals only the caller's own row.
4. Explicit: a repository that already has a live project of the user answers `409 PROJECT_REPOSITORY_TAKEN` with `meta.projectId`. Shortcut: returns that project with `200`, ignoring `name` and `description`.
5. A taken name answers `409 PROJECT_NAME_TAKEN` (the shortcut's default name is `owner/name` from the latest snapshot; no automatic suffix).
6. Write. Simultaneous creations are decided by the unique indexes: the explicit loser answers the matching `409`, the shortcut loser re-reads and returns the winner with `200`.

No GitHub call and no job, on either route.

#### Edit

- `name` and `description` are both optional; an omitted field is unchanged. `description: null` or a blank string clears it. An empty body, or values equal to the stored ones, answers `200` with no write.
- Same rules as creation; a taken name answers `409 PROJECT_NAME_TAKEN`.

#### Repository

- A ref attaches (project without repository) or changes the repository; `null` detaches.
- The same checks as creation (`404`, `409 PROJECT_REPOSITORY_NOT_ADDED`, `409 PROJECT_REPOSITORY_TAKEN` with `meta.projectId`).
- Changing or detaching while the project has links answers `409 PROJECT_HAS_LINKS` with `meta.linkCount`; checked under the project-row lock ([github-link.md](../specs/issues/github-link.md#same-repository-rule-and-repository-changes), E62).
- Setting the current repository again, or detaching a project without one, is a no-op `200` (links or not).
- Never syncs or enqueues a job.

#### Delete

- Soft delete as in [projects.md](../specs/issues/projects.md#deletion); no confirmation flag (the UI warns beforehand, decided there).
- Answers `200` `{ "unsentIssueCount": 2 }`, the number of issues whose markers were discarded. `200` rather than `204` because it has a body.
- A second delete, or any route on a deleted project, answers `404`.

#### Refusal data: `error.meta`

Refusals that carry data (`meta.projectId`, `meta.linkCount`, and later the attach differences) use a new optional `error.meta` object of the standard error shape, set at the throw site. It is decided here; `docs/agents/architecture/backend.md` describes the code as it is, so the implementation adds it there in the change that builds it. It never carries internal ids, GitHub content or credential material.

### Issue routes (decided)

| Action | Route | Body | Success |
|---|---|---|---|
| Listing | `POST /projects/:projectId/issues.json` | `{ page, perPage, state, search }` | `200` `{ issues, pagination }` |
| Create | `POST /projects/:projectId/issues/create.json` | `{ title, body?, state? }` | `201` issue |
| Show | `POST /projects/:projectId/issues/:issueId/show.json` | none | `200` issue |
| Edit | `POST /projects/:projectId/issues/:issueId/edit.json` | `{ title?, body?, state? }` | `200` issue |
| Delete | `POST /projects/:projectId/issues/:issueId/delete.json` | none | `200` `{}` |

Field rules are in [Input validation](#input-validation). Every route goes through the project's single access check first; a deleted or foreign project, or an issue of another project, answers `404`.

#### Issue object

```json
{
  "id": "8b1e…04",
  "title": "Login fails on Safari",
  "body": "…",
  "state": "open",
  "createdAt": "2026-11-17T12:00:00Z",
  "updatedAt": "2026-11-17T12:00:00Z",
  "link": null
}
```

- `link` is `null` for an unlinked issue, otherwise the link object defined in [How sync is exposed](#how-sync-is-exposed).
- `updatedAt` is the value the attach confirmation echoes back (E61).
- Listing rows are the same object **without `body`** (up to 65536 characters each); show, create and edit return it with `body`.

#### Listing

- `page` and `perPage` as in the project listing (default 50, maximum 100). `state`: `open` (default), `closed` or `all`. `search`: trimmed, at most 100 characters, case-insensitive literal substring of the title, LIKE-escaped as in Repositories. Invalid values answer `400`.
- No filter by link or link state in v1 (a "links by status" index was rejected in [model.md](../specs/issues/model.md#indexes), and derived states mix stored and in-memory data).
- **Sort:** newest created first, `created_at` desc then `id` desc, so edits and sync pulls never reorder pages. No sort parameter.
- **Index:** `model.md`'s (`project_id`, `state`) becomes (`project_id`, `state`, `created_at`) (`idx_issues_project_id_state_created_at`), which serves the `open` and `closed` listings in order. `all` uses the `project_id` prefix and sorts in memory, acceptable at per-project scale. `model.md` is updated in the same PR.
- The rows' link objects are loaded for the page only (one query for links and marker existence by issue ids, the repository status once per project, the rate-limit waiting sets from memory). A read never enqueues a job.

#### Create and edit

- Create makes an unlinked issue (`state` defaults to `open`); it never calls GitHub and enqueues nothing. Linking is a separate step (import creates an issue from GitHub directly).
- Edit: an omitted field is unchanged; `body: null` or a blank body clears it. Values equal to the stored ones make no write, no marker and no revision bump (E12).
- Editing a synced field of a `linked` or `sync_failed` link upserts the marker in the same transaction and enqueues T1 after the commit; a `gone` link's edits are local only ([sync.md](../specs/issues/sync.md#triggers)). The response's link object reflects the derived *pending* state.

#### Delete

- **Only an unlinked issue can be deleted.** A linked one, in any link state, answers `409 ISSUE_LINKED`; the user unlinks first, which already carries the unsent-changes confirmation (E63), so there is a single place where a pending write can be dropped.
- Hard delete, never touching GitHub. The check and the delete run under the project-row then issue-row lock, so a concurrent attach (which also locks the project first) cannot leave a link on a deleted issue. `model.md`'s "single issue deletion: marker, link, then the issue" becomes "the issue only, refused while a link exists" in the same PR.
- A second delete answers `404`.

### GitHub link routes (decided)

| Action | Route | Body | Success |
|---|---|---|---|
| Import | `POST /projects/:projectId/issues/import.json` | `{ number }` | `201` issue (linked) |
| Attach | `POST /projects/:projectId/issues/:issueId/attach.json` | `{ number, confirmUpdatedAt? }` | `200` issue (linked) |
| Unlink | `POST /projects/:projectId/issues/:issueId/unlink.json` | `{ discardUnsentChanges? }` | `200` `{ issue, droppedUnsentChanges }` |

`number` is the GitHub issue number in the project's repository, a positive integer ([github-link.md](../specs/issues/github-link.md#creating-a-link)). Import and attach share one service method.

#### Order of checks (import and attach)

1. DTO and path validation (`400`), then the single access check (`404`).
2. Attach only: the Kerghan issue already has a link: `409 ISSUE_ALREADY_LINKED` (E64).
3. The project has no repository: `409 PROJECT_HAS_NO_REPOSITORY`. Its repository is Unavailable (or dangling): `409 PROJECT_REPOSITORY_UNAVAILABLE`. Neither makes a GitHub call; Unknown is allowed.
4. One `GET` of the GitHub issue with the owner's credential, outside any transaction. Failures map as below; nothing is stored, no job, no wait.
5. A pull request: `422 GITHUB_ISSUE_IS_PULL_REQUEST` (E3; the input is of the wrong kind, not a conflict).
6. Transaction, locking the project then (attach) the issue: the repository changed meanwhile, `409 PROJECT_REPOSITORY_CHANGED` (retryable, E62); the GitHub issue is already linked by this user, `409 GITHUB_ISSUE_ALREADY_LINKED` with `meta.projectId` and `meta.issueId` of the existing link (E4, E46, also when the unique index decides a race); attach only, the issue gained a link meanwhile, `409 ISSUE_ALREADY_LINKED`; attach only, the confirmation check below.
7. Write: the link with status `linked`; import also creates the issue with GitHub's values.

#### GitHub failures on link creation (E57 to E60)

| GitHub outcome | Answer |
|---|---|
| Not found, `410`, a `301` that is not a rename | `404 GITHUB_ISSUE_NOT_FOUND` (`GitHub issue not found`), distinct from the Kerghan `404 NOT_FOUND` |
| Rate limited | `503 GITHUB_RATE_LIMITED` (existing) with `retryAfterSeconds` and `Retry-After` |
| No usable integration, `401`, `403` | `409 GITHUB_CREDENTIAL_UNUSABLE` with `meta.reason` in the sync vocabulary: `no_credential`, `credential_invalid` or `forbidden` (a `401` still invalidates the integration; a handle alone is `no_credential`, E20) |
| Timeout, network error, `5xx`, unclassifiable `301` | `502 GITHUB_UNAVAILABLE` (existing) |

A rename `301` is followed once inside the adapter and is not a failure (E65). GitHub error bodies are never echoed.

#### Attach confirmation (E61)

- The `409` is the warning: attach is first called without `confirmUpdatedAt`. Equal values link at once (`200`). Different values answer `409 ISSUE_ATTACH_CONFIRMATION_REQUIRED` with `meta.differences` (a subset of `["title", "body", "state"]`) and `meta.updatedAt` (the issue's current `updatedAt`). The UI asks, then repeats the call with `confirmUpdatedAt` set to that value.
- Under the issue-row lock, `confirmUpdatedAt` must equal the stored `updated_at` exactly; a missing or stale value while values differ answers the same `409` with the current differences and `updatedAt`. Each call makes one GitHub read; there is no separate preview route.
- A confirmation sent while the values are equal is ignored.
- **Precision:** `issues.updated_at` becomes `datetime(3)` (milliseconds from the injected `Clock`), so an edit made in the same second as the warning still changes it. `model.md` is updated in the same PR; the other `datetime` columns are unchanged.
- `meta.differences` names fields only, never GitHub content (rendering GitHub content is #490's).

#### Unlink (E63, E64)

- No link: `409 ISSUE_NOT_LINKED`, distinct from `404`; the UI treats it as already unlinked.
- A marker exists and `discardUnsentChanges` is not `true`: `409 ISSUE_UNLINK_HAS_UNSENT_CHANGES`; nothing changes.
- Otherwise the link and its marker are deleted in lock order and the answer is `200` with the issue (`link: null`) and `droppedUnsentChanges` (`true` only if a marker was discarded).
- Works in every link state and while the repository is Unavailable; never calls GitHub or enqueues a job.

### How sync is exposed

#### Link object

The `link` field of an issue (`null` when unlinked):

```json
{
  "number": 12,
  "url": "https://github.com/darthjee/kerghan/issues/12",
  "state": "sync_failed",
  "states": ["sync_failed", "pending"],
  "reason": "credential_invalid",
  "rateLimitedUntil": null,
  "lastSyncedAt": "2026-11-17T11:00:00Z",
  "stale": false
}
```

| Field | Meaning |
|---|---|
| `number`, `url` | The GitHub issue number and its URL, built from the repository's stored `owner`/`name`. |
| `state` | The primary state: the first of `states`. |
| `states` | Every state that applies, in the precedence order of [github-link.md](../specs/issues/github-link.md#link-states): `gone`, `sync_failed`, `repository_unavailable`, `rate_limited`, `pending`. `linked` appears (alone) only when none of the others applies. |
| `reason` | The stored `status_reason`: `deleted`/`moved` for `gone`; `retries_exhausted`, `no_credential`, `credential_invalid`, `forbidden` for `sync_failed`; otherwise `null`. |
| `rateLimitedUntil` | The reset time while the link is in a waiting set (in memory, so it disappears on restart); otherwise `null`. Never names the integration. |
| `lastSyncedAt` | Never `null` (set on link creation). |
| `stale` | `lastSyncedAt` older than `KERGHAN_ISSUES_SYNC_STALE_AFTER_SECONDS`; always `false` for `gone`. |

- Derived states are computed on read and never stored; a read never enqueues a job ([sync.md](../specs/issues/sync.md#staleness)).
- There is no "refresh queued" or "syncing" state in v1: queue membership is not exposed. After a trigger the UI re-reads the issue (show or listing); when and how often is #491's.
- Wording and placement of every state are #491's.

#### Trigger routes

| Trigger | Route | Body | Answers |
|---|---|---|---|
| T2 issue refresh | `POST /projects/:projectId/issues/:issueId/refresh.json` | none | `202` `{ issue, alreadyFresh: false }` enqueued; `200` `{ issue, alreadyFresh: true }` skipped |
| T3 project refresh | `POST /projects/:projectId/refresh.json` | none | `202` `{ enqueued, skippedFresh }` |
| T4 retry sync | `POST /projects/:projectId/issues/:issueId/retry-sync.json` | none | `202` `{ issue }` reset and enqueued; `200` `{ issue }` no-op |

- **T2:** "already fresh" is a link with no marker whose `lastSyncedAt` is under 60 seconds old; a link with a marker is always enqueued. A `sync_failed` or rate-limited link is enqueued like any other.
- **T3:** enqueues one reconcile per non-`gone` link of the project, oldest `lastSyncedAt` first, skipping fresh marker-less links; `enqueued` and `skippedFresh` are counts. A project with no links answers `202` with zeros.
- **T4:** a `sync_failed` link is reset to `linked` (reason `null`) at once and enqueued, so the returned link reads *pending* or `linked`. A `linked` link (double click) is a no-op `200` with nothing enqueued.
- **Refusals,** before any reset or enqueue and with no GitHub call: no link, `409 ISSUE_NOT_LINKED`; a `gone` link (T2, T4), `409 ISSUE_LINK_GONE`; no repository (T3), `409 PROJECT_HAS_NO_REPOSITORY`; repository Unavailable or dangling (T2, T3, T4), `409 PROJECT_REPOSITORY_UNAVAILABLE`.
- **Retry while Unavailable is refused, not reset.** Otherwise the reset would clear the failure reason and the job would stop at the repository guard without setting a new one. `sync.md`'s "retry resets to `linked` at once" gains this exception in the same PR.
- No trigger route has a cooldown or `429`: the 60-second fresh skip and the per-integration rate-limit pause bound the GitHub calls ([sync.md](../specs/issues/sync.md#staleness)).

### Error catalogue

Standard error shape ([backend.md](../architecture/backend.md#error-responses)) plus the new optional `error.meta` ([Refusal data](#refusal-data-errormeta)). New codes join `ErrorCodes` (`core/error-codes.ts`); their helpers live in `issues/issues-http-errors.ts`, like `repositories/repositories-http-errors.ts`. The `502`/`503` reuse `githubUnavailable()`/`githubRateLimited()` from `core/github-http-errors.ts`.

| Status | Code | Message | `meta` | Where |
|---|---|---|---|---|
| `400` | `VALIDATION_FAILED` (existing) | standard | | Any body or path id (non-uuid) failing [Input validation](#input-validation) |
| `401` | `UNAUTHORIZED` (existing) | standard | | No session (`JwtGuard`) |
| `403` | `FORBIDDEN` (existing) | standard | | Foreign origin (`OriginGuard`) |
| `404` | `NOT_FOUND` (existing) | `Project not found` | | Project missing, another user's or deleted, on every `/projects/:projectId/…` route |
| `404` | `NOT_FOUND` (existing) | `Issue not found` | | Issue missing or in another project (the project resolved) |
| `404` | `NOT_FOUND` (existing) | `Repository not found` | | Repo ref not among the caller's rows (same message as Add) |
| `404` | `GITHUB_ISSUE_NOT_FOUND` | `GitHub issue not found` | | Import/attach: not found, `410`, non-rename `301` (E57) |
| `409` | `PROJECT_NAME_TAKEN` | `A project with this name already exists` | | Create, shortcut, edit |
| `409` | `PROJECT_REPOSITORY_TAKEN` | `This repository already has a project` | `projectId` | Explicit create, repository change |
| `409` | `PROJECT_REPOSITORY_NOT_ADDED` | `Add this repository first` | | Create, shortcut, repository change |
| `409` | `PROJECT_HAS_LINKS` | `Unlink the project's issues before changing its repository` | `linkCount` | Repository change or detach with links (E62) |
| `409` | `PROJECT_HAS_NO_REPOSITORY` | `This project has no repository` | | Import, attach, project refresh |
| `409` | `PROJECT_REPOSITORY_UNAVAILABLE` | `The project's repository is unavailable` | | Import, attach, refreshes, retry sync |
| `409` | `PROJECT_REPOSITORY_CHANGED` | `The project's repository changed; try again` | | Import/attach race with a repository change (E62) |
| `409` | `GITHUB_ISSUE_ALREADY_LINKED` | `This GitHub issue is already linked` | `projectId`, `issueId` | Import, attach (E4, E46) |
| `409` | `ISSUE_ALREADY_LINKED` | `This issue is already linked` | | Attach (E64) |
| `409` | `ISSUE_ATTACH_CONFIRMATION_REQUIRED` | `Attaching replaces this issue's values` | `differences`, `updatedAt` | Attach with differing values and a missing or stale confirmation (E61) |
| `409` | `ISSUE_NOT_LINKED` | `This issue is not linked` | | Unlink, refresh, retry sync (E64) |
| `409` | `ISSUE_UNLINK_HAS_UNSENT_CHANGES` | `This issue has changes not yet sent to GitHub` | | Unlink without `discardUnsentChanges` (E63) |
| `409` | `ISSUE_LINK_GONE` | `The GitHub issue is no longer available` | | Refresh, retry sync on a `gone` link |
| `409` | `ISSUE_LINKED` | `Unlink this issue before deleting it` | | Issue delete |
| `409` | `GITHUB_CREDENTIAL_UNUSABLE` | `The integration for this repository needs attention` | `reason` | Import/attach: no usable integration, `401`, `403` (E59) |
| `422` | `GITHUB_ISSUE_IS_PULL_REQUEST` | `This is a pull request, not an issue` | | Import, attach (E3) |
| `502` | `GITHUB_UNAVAILABLE` (existing) | existing | | Import/attach: timeout, network, `5xx`, unclassifiable `301` (E60) |
| `503` | `GITHUB_RATE_LIMITED` (existing) | existing | | Import/attach rate limited (E58), with `retryAfterSeconds` |

- 17 new codes; none is used outside this module.
- **Not-found messages:** project first, then issue, so a foreign project never reveals its issues. The issue lookup is always inside the resolved project.
- `meta` values are public ids (uuids), counts, field names, timestamps or the sync reason vocabulary; never internal ids, GitHub content or credential material.
- Messages are final English strings; the UI may map codes to its own wording (#491).
- Sync failures in jobs never become HTTP errors: they show only in the [link object](#link-object).

### Input validation

Every failure answers `400 VALIDATION_FAILED` (with `error.details`) before any lookup, write or GitHub call. Unknown properties are stripped. **Types are strict:** a value of the wrong JSON type (`"1"` for a number, `"true"` for a boolean) is rejected, never coerced.

**Lengths count Unicode code points,** matching MySQL's `varchar` under utf8mb4. class-validator's `MaxLength` counts UTF-16 units (an emoji counts twice), so the DTOs use a code-point validator; a 4-byte character counts once (model.md E14).

| Field | Routes | Rule |
|---|---|---|
| Path `:projectId`, `:issueId` | all nested routes | A uuid (`ParseUUIDPipe`). |
| `name` | project create, shortcut, edit | String, trimmed, 1 to 100 code points after trimming; blank rejected. Required on explicit create, optional on the shortcut (default `owner/name`) and edit; `null` rejected. |
| `description` | project create, shortcut, edit | String or `null`, trimmed, at most 2000 code points; blank or `null` is stored as none. |
| `repository` | create, shortcut, repository | A [repo ref](../backend/routes/repositories.md#repo-ref) object with its own rules. Optional on explicit create (absent or `null` is a non-code project); required and non-null on the shortcut; required on the repository route, where `null` detaches. |
| `title` | issue create, edit | String, trimmed, 1 to 256 code points after trimming; blank rejected. Required on create; optional on edit, where `null` is rejected. |
| `body` | issue create, edit | String or `null`, at most 65536 code points, **not trimmed** (Markdown whitespace is content). Exactly `''` or `null` is stored as `NULL`; whitespace-only bodies are kept as they are. The same normalization function as for GitHub values ([sync.md](../specs/issues/sync.md#fields-and-ownership)). |
| `state` | issue create, edit | `open` or `closed`; default `open` on create. |
| `number` | import, attach | Integer, 1 to 2147483647 (the `int` `github_number` column). |
| `confirmUpdatedAt` | attach | Optional ISO 8601 UTC timestamp with milliseconds, as returned in `updatedAt`; compared as an instant. |
| `discardUnsentChanges` | unlink | Optional boolean; only `true` discards. |
| `page`, `perPage` | both listings | Integers; `page` ≥ 1 (default 1), `perPage` 1 to 100 (default 50). |
| `state` (filter) | issue listing | `open` (default), `closed` or `all`. |
| `search` | both listings | String, trimmed, at most 100 code points; empty means no search; `LIKE` metacharacters escaped. |

- **Output timestamps** are ISO 8601 UTC strings. An issue's `updatedAt` carries milliseconds (`datetime(3)`); other timestamps carry the second precision of their columns.
- No content rules beyond these (no markup stripping or control-character filtering): titles and bodies may hold Markdown, and how they are rendered is #490's.
- Validation runs on input only. Values pulled from GitHub are stored as GitHub returns them, and an edit sends only the fields it changes, so an inbound value outside these rules (an untrimmed title, for instance) never blocks an unrelated edit.

## Benefits

- The implementation spawned by #492 builds the API against fixed routes, payloads, codes and validation, with no decisions of its own.
- Routes follow the existing conventions (POST-only, `user-scoped` cache, uuids, the repo ref), so caching, CSRF and the access matrix need no new rules.
- Every refusal named elsewhere in the spec set gets one code, so the UI (#491) and tests can rely on them.
