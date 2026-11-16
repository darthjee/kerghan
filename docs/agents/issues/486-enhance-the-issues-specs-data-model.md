# Issue: Enhance the Issues specs: data model

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is first defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`). This issue is documentation only: no code, migrations or endpoints.

Enhance `docs/agents/specs/issues/model.md` (created by #484, builds on the projects spec of #485): resolve its open questions, fill gaps and make it precise enough for an implementation issue to build against without making its own decisions. Keep the other spec files consistent: when a decision here changes another file, update it in the same PR.

## Problem

`model.md` lists only the entities and relations. Its open questions are unresolved: columns, types and lengths; indexes (including how MySQL enforces uniqueness of project name and repository among non-deleted projects); which GitHub data is stored; the shape of the durable pending marker; cleanup hooks; and how the `product.md` statement that issue data is not persisted is rewritten. An implementation issue would have to decide these itself.

## Expected Behavior

- `model.md` defines the four tables with columns, types, nullability, defaults, constraints and indexes, the pending marker and its rules, the cleanup contracts, the edge cases, the alternatives considered and the fold list for `product.md`, and ends with an up-to-date "Required tests" section.
- It has no unresolved open question, or lists any that remain with the reason and the owner issue (see Notes).
- `projects.md`, `github-link.md`, `sync.md`, `security.md`, `edge-cases.md`, `testing.md` and the index (`issues.md`) carry short consequence bullets pointing at `model.md`, and their open questions that this issue settles are resolved.
- No code, migrations or endpoints are added.

## Solution

Documentation only: rewrite `docs/agents/specs/issues/model.md`, plus short consequence bullets with pointers in the other spec files that a decision touches. Specs describe decisions, not code. The decisions below were agreed in the enhancement dialogue.

### Module and table layout

- One `issues` module owns projects and issues, so the single access check, the soft-delete cascade and the sync live together (no separate `projects` module).
- Tables follow the Repositories convention (main table named after the module, others prefixed): `issues_projects`, `issues`, `issues_github_links`, `issues_pending_writes`.
- Conventions: `int` auto-increment `id`, plain `int` `user_id` (logical FK to `auth_users.id`), explicit `varchar` lengths, `datetime`, index names `idx_<table>_<cols>`, timestamps from the injected `Clock` (never `NOW()` in SQL). All foreign keys are logical (no physical constraints), as in Repositories.
- A project's repository is `repository_id`, a logical FK to `repositories.id`; the summary is read through Repositories' exported service, never a join.
- The GitHub link is a separate table: the optional one-to-one is a row existing or not, unlinking and project deletion are row deletes, and link states and cached GitHub data can grow without widening `issues`.

### `issues_projects`

| Column | Type | Notes |
|---|---|---|
| `id` | `int` auto-increment | |
| `user_id` | `int` | Logical FK to `auth_users.id`. |
| `name` | `varchar(100)` | Counted in characters. |
| `description` | `varchar(2000) NULL` | Blank stored as `NULL`. |
| `repository_id` | `int NULL` | Logical FK to `repositories.id`; `NULL` is a non-code project. |
| `deleted_at` | `datetime NULL` | Soft-delete marker. |
| `deleted_token` | `int NOT NULL DEFAULT 0` | `0` while live; set to the project's `id` in the same `UPDATE` that sets `deleted_at`. |
| `created_at`, `updated_at` | `datetime` | |

- **Uniqueness among live projects** (MySQL has no partial unique index): two plain unique indexes, (`user_id`, `name`, `deleted_token`) and (`user_id`, `repository_id`, `deleted_token`). Live rows collide, deleted rows never do, and a `NULL` repository never collides. No raw SQL, so migrations keep the `Table`/`TableIndex` style. The database decides simultaneous creations. `deleted_at` and `deleted_token` are always written together (a test checks it).
- Case-insensitivity comes from the default `utf8mb4_0900_ai_ci` collation, which is also accent-insensitive: names differing only by case or accents are duplicates (the same reliance as Auth's default-user lookup and Repositories' `fullName` lookup).

### `issues` (Kerghan issues)

| Column | Type | Notes |
|---|---|---|
| `id` | `int` auto-increment | The issue's reference. |
| `project_id` | `int` | Logical FK to `issues_projects.id`. |
| `title` | `varchar(256)` | Required; 256 is GitHub's title limit. |
| `body` | `mediumtext NULL` | Application cap of 65536 characters (GitHub's body limit); `text` is too small for that many utf8mb4 characters. Blank stored as `NULL`. |
| `state` | `varchar(16)` | `open` or `closed`, default `open`. |
| `created_at`, `updated_at` | `datetime` | |

- **No `user_id` on issues.** Access and cleanup go through the project (guardrail 2: issues derive access from their project and carry no authorization owner).
- No per-project issue number in v1 (the `id` is the reference), no `created_by` (the actor is the owner in v1).
- Deleting a single issue is a hard delete, if the API offers it (#489 decides); its link and marker go with it, and GitHub is never touched.
- **Labels are not in v1.** Only title, body and state are stored, so #488 may only sync those three fields; adding another field (labels, assignees, milestone, comments, reactions) means adding its column or table to `model.md` in the same PR. Labels are a follow-up with their own table and sync rules.

### `issues_github_links`

| Column | Type | Notes |
|---|---|---|
| `id` | `int` auto-increment | |
| `user_id` | `int` | The project owner, denormalised for the uniqueness rule only, never for authorization. |
| `issue_id` | `int` | Logical FK to `issues.id`; unique, so an issue has at most one link. |
| `github_issue_id` | `bigint` | GitHub's global issue id, the stable key; unique with `user_id`. Mapped to a JS number with a `from: Number` transformer, as Repositories does for `github_id`. |
| `github_number` | `int` | The number inside the repository, for display and API calls (owner and name come from the project's repository row). |
| `status` | `varchar(32)` | The link state. Values are owned by #487 and #488; the spec only fixes that the column exists and that `sync_failed` is one of the values. |
| `base_title`, `base_body`, `base_state` | `varchar(256)`, `mediumtext NULL`, `varchar(16)` | The values as last synced (the **base snapshot**), so #488 can tell which side changed which field. If #488 picks plain last-write-wins it may drop them in its own PR. |
| `github_updated_at`, `last_synced_at` | `datetime NULL` | GitHub's `updated_at` as last seen; the last successful sync. |
| `etag` | `varchar(255) NULL` | For conditional requests. |
| `created_at`, `updated_at` | `datetime` | |

- No `repository_id` on the link: the project's repository cannot change in v1, and the repository check happens when the link is created.
- The link is for issues only; GitHub's issues endpoint also returns pull requests, and refusing or ignoring them is #487's rule. If a transfer changes an issue's id or number, #487 settles it.
- Any column #487 or #488 needs is added to `model.md` in the same PR.

### `issues_pending_writes` (the pending marker)

| Column | Type | Notes |
|---|---|---|
| `id` | `int` auto-increment | |
| `link_id` | `int` | Logical FK to `issues_github_links.id`; unique, so one marker per link. |
| `revision` | `int` | Starts at 1; bumped by every edit of a synced field. |
| `marked_at` | `datetime` | Set when first created; the boot re-enqueue goes oldest first. |
| `updated_at` | `datetime` | |

- **Only linked issues get markers** (the epic has no "create a GitHub issue from a Kerghan issue" path). An edit of an unlinked issue creates none.
- **Coalesced, no payload.** An edit does `INSERT … ON DUPLICATE KEY UPDATE revision = revision + 1`, in the same transaction as the issue update. The job diffs the current issue against the base snapshot to learn what to push.
- **Compare-and-clear.** A job reads the revision, pushes, then in one transaction updates the base snapshot (with the values pushed) and deletes the marker `WHERE link_id = ? AND revision = ?`. If no row is deleted, an edit landed during the push and the job re-enqueues itself.
- Attempts (retry and cooldown, from #479) are in memory; after a restart the marker is re-enqueued fresh. Exhausted retries set the link `status` to `sync_failed` and keep the marker.
- At boot every marker is re-enqueued by `link_id` (ids only; no credentials or content in job params or logs). Inbound refresh has no marker (on demand).
- Cleanup needs no `user_id` on the marker: user cleanup goes marker → link (links carry `user_id`); project deletion goes through the project's issues.

### Indexes

| Table | Index | Serves |
|---|---|---|
| `issues_projects` | unique (`user_id`, `name`, `deleted_token`) | Name uniqueness among live projects; the user's listing by name; lookups by name. |
| `issues_projects` | unique (`user_id`, `repository_id`, `deleted_token`) | Repository uniqueness among live projects; the shortcut's existing-project lookup; the future repository-removal refusal. |
| `issues` | (`project_id`, `state`) | Listing a project's issues, optionally by state. |
| `issues_github_links` | unique (`user_id`, `github_issue_id`) | The link rule; its leftmost column also covers user cleanup. |
| `issues_github_links` | unique (`issue_id`) | At most one link per issue; issue-to-link lookup; project cleanup. |
| `issues_pending_writes` | unique (`link_id`) | One marker per link; marker lookup from a job. |

- The "live project" predicate is `deleted_token = 0` (not `deleted_at IS NULL`), so reads use the unique indexes. No separate index on `issues_projects.user_id`, none on the marker table (it holds only unsent changes), none for "links by status" (#487 and #488 add one if needed). The issues listing index is minimal on purpose: #489 decides the sort and adds a sort index in the same PR if needed. The longest index name is 55 characters, under MySQL's 64.

### Cleanup hooks

- **Lock order:** every multi-table write in the module locks projects → issues → links → markers, so cleanups never deadlock with a running job or a project deletion.
- **`user.deleted`** (awaited event after the user-row delete commits; nothing emits it yet): the Issues module listens, as Repositories does. One transaction deletes the markers (through links), the links by `user_id`, the issues (through the user's projects) and the user's projects, including soft-deleted ones. A failure is logged at error level with safe fields (`userId`, error class) and never blocks the deletion; a future deletion path must retry the event or run an orphan sweep. Creating a project re-reads the user through Auth's export (`lockExistingUser`) in the same transaction, so no orphan is created for a user deleted a moment earlier. A job after the delete only updates or deletes guarded rows and never inserts.
- **`integration.deleted`: no hook.** Nothing in the module stores an integration id; the owner's integrations are resolved at job time through the Integrations module. If none is usable the job follows #488's no-credential rule and the markers stay.
- **Project deletion (soft)**, one transaction: count the project's issues that have markers (the number the response reports), set `deleted_at` and `deleted_token`, delete the markers and the links of its issues. The `issues` rows stay, unreachable, with no purge in v1.
- **Single issue deletion:** marker, link, then the issue, in lock order.
- **Repository removal (not built):** it must refuse with `409` while a live project of the user uses the repository. A project requires `added_at`, so its repository row is never pruned; a dangling `repository_id` reads as Unavailable. The spec fixes the rule and a read-only check the Issues module exposes ("does a live project of this user use repository X?"). Because Issues already depends on Repositories, the removal feature must not create an import cycle; the mechanism is chosen when that feature is built (not decided, no owner issue yet).

### `product.md` persistence statement

Narrow carve-out. At fold time (#492): keep "fetched GitHub issue data is not persisted by default" for the existing live listing; add that Kerghan persists its own projects, issues, links and markers and, only for a linked issue, a snapshot of its GitHub data, with the backend reading and writing GitHub for linked issues with the owner's credentials inside the Integrations module as an explicit, narrow exception to "read by the browser"; "Opt-in issue persistence" (fetched issues for history and trends) stays deferred and distinct.

`model.md` carries a table of the statements to rewrite at fold time: `product.md` ("What the backend persists", "Issue fetching model", "GitHub access", and the two Deferred items), `AGENTS.md` (the project overview and the "lightweight account" bullet), `CLAUDE.md` Boundaries ("Issue fetching itself still reads GitHub unauthenticated…"), `architecture/security.md` (GitHub credentials stay in the backend), and `summary.md` and `flow.md`. The root files hold the user's own rules: #492 proposes the edit and asks before touching them.

### Alternatives considered

`model.md` gets a short "Alternatives considered" table so an implementer does not reopen these: two modules (access check and deletion cascade would cross a module boundary); link as nullable columns on `issues`; generated columns or a functional unique index for the uniqueness (raw SQL and TypeORM workarounds, no precedent; an application-only check cannot decide simultaneous creations); a denormalised `user_id` on issues (second copy of ownership, against guardrail 2); labels now (forces a two-way label sync design first); repository plus number as the GitHub key (breaks if the number changes); timestamps only for conflicts (one whole edit overwrites the other); marker as columns on the link (edits and inbound sync write one row), derived from the snapshot diff (unindexed scan, no revision) or a row per change with a payload (unbounded queue); physical foreign keys (break the module pattern); Kerghan issues as a pure cache of GitHub issues (a project with no repository, or an issue with no link, could not exist).

### Edge cases

Recorded as a table in `model.md` (each row is also a required test):

| # | Case | Expected behavior |
|---|---|---|
| 1 | An edit lands while a push is in flight | The marker's `revision` changed, so compare-and-clear deletes no row and the job re-enqueues itself; the base snapshot is written with the values that were pushed. |
| 2 | Two simultaneous edits of one linked issue | Each upsert bumps the revision, so the marker is never lost; the issue row is last-write-wins. |
| 3 | An edit reverts to the base values | The job diffs, finds nothing to push, clears the marker and makes no GitHub call. |
| 4 | Unlink, project delete or user delete during a push | Guarded writes affect no row, so the job stops (no insert, no error); a change GitHub already received stays there. |
| 5 | Two users link the same GitHub issue | Allowed (the unique index includes `user_id`). |
| 6 | One user links one GitHub issue twice at once, or attaches two to one issue | Unique (`user_id`, `github_issue_id`) and unique (`issue_id`) decide; the other is refused (the code is #487's). |
| 7 | A project is deleted and its GitHub issue is linked again from another project | Allowed (the link was deleted); the old project's issue rows stay, unreachable. |
| 8 | Two projects race for one repository, including an attach | The unique index decides; the loser gets `409`. |
| 9 | Soft-deleting an already-deleted project | Answers `404`; the update is also guarded by `deleted_token = 0`, so the token is set once. |
| 10 | `deleted_token` reuse | A project's id is never `0`, so a deleted token never equals the live value and tokens never collide. |
| 11 | Boot with markers | Every marker is re-enqueued once, oldest first, by `link_id`; a second job for the same link is a no-op; a link whose repository is Unavailable keeps its marker. |
| 12 | A crash between the issue update and the marker upsert | One transaction: both roll back or both stay. |
| 13 | A user is deleted and the listener fails | Rows are orphaned and logged; jobs for them are no-ops; a later sweep or retry cleans them. |
| 14 | A 4-byte character (emoji) in a title or body | Stored intact (utf8mb4; lengths count characters). |
| 15 | A GitHub issue with a `state_reason` (not planned, reopened) | Only `open` and `closed` are stored; the reason is not stored in v1, so a close pushed from Kerghan uses GitHub's default reason; #488 decides whether that loss matters. |
| 16 | A GitHub id above 2³¹ | `bigint` with the `from: Number` transformer round-trips it. |

### Scope boundaries

- **In scope:** the four tables, constraints and indexes; the logical FKs and ownership; the marker and its compare-and-clear rule; the stored GitHub data and the fold list; the cleanup contracts and lock order; the "Required tests" section.
- **Owned elsewhere:** routes, payloads and the issues listing sort (#489); link states, unlinking and transfers (#487); synced fields, conflict rules, staleness and retry values (#488); encryption at rest of issue content, retention of soft-deleted projects and quotas (#490); UI (#491); code and migrations (spawned by #492).
- **Not stored in v1:** labels, assignees, milestones, comments and reactions; a per-project issue number; `created_by`; an audit of edits; any schema for sharing, members or roles.

### Backward compatibility, testing, performance and security

- **Backward compatibility:** all four tables are new; no existing table changes and no data is migrated or backfilled (existing users start with no projects; adding a repository never creates one). Migrations are named `<timestamp>-issues-<action>.ts`, create the tables in the order above and `down` drops them in reverse. No existing endpoint changes; rolling back means dropping the tables (the feature is not released yet).
- **Testing:** DB-backed tier, as Repositories (uniqueness, concurrency and transactions need real MySQL). The "Required tests" section covers the three unique constraints, uniqueness among non-deleted projects with `deleted_at` and `deleted_token` written together, compare-and-clear, boot re-enqueue, the cleanup contracts and lock order, utf8mb4 and `bigint` round-trips, a migration `up` and `down` test, a two-user baseline, and every edge-case row.
- **Performance and security:** every query is on an index above and bounded to one user's or one project's rows (the marker table is the only unindexed scan, and it holds only unsent changes); a body is capped at 65536 characters and a linked issue keeps one extra copy (the base snapshot); no secret sits in these tables and job params and logs carry ids only; every access goes through the project's single access check, and the link's `user_id` is for uniqueness only; issue content of private repositories is stored unencrypted, as Repositories stores private metadata, so encryption, retention and quotas are #490's.

## Benefits

- An implementation issue can build the tables, migrations and sync against `model.md` without making its own data decisions.
- The hard MySQL question (uniqueness among non-deleted projects under soft delete) and the durable-write design (marker, compare-and-clear) are settled once, with the rejected alternatives recorded.
- The statements the feature supersedes are listed for the fold issue, so none is left contradicting the permanent docs.

## Acceptance criteria

- `model.md` has no unresolved open question except those listed under Notes, each with the reason and the issue that settles it.
- `model.md` contains the four table definitions, the indexes, the marker rules, the cleanup contracts, the edge-case table, the alternatives table and the fold list for the statements that supersede `product.md`.
- The "Required tests" section matches the rules in the file (unique constraints, uniqueness among non-deleted projects, compare-and-clear, boot re-enqueue, cleanup, round-trips, migration up/down, two-user baseline, every edge-case row).
- Related spec files (`projects.md`, `github-link.md`, `sync.md`, `security.md`, `edge-cases.md`, `testing.md`, the `issues.md` index) are consistent with it, and their open questions owned by #486 are resolved or moved with a reason.
- Only files under `docs/agents/specs/` are edited; no code, migrations, endpoints or permanent docs.
- Specs contain no real tokens, secrets, personal data or private repository names.

## Notes

Responsible agent: `architect`. Builds on the projects spec (#485).

Decisions already made in the epic (kept): a project is the home of issues; 0 or 1 linked repository, at most one live project per repository per user; private single owner (404 for others); the link is one to one and unique per user and GitHub issue; two-way sync; workers on demand only with a durable pending marker re-enqueued at boot; jobs receive ids only and credentials stay in the Integrations module; the project soft delete from #485 (name, repository and links freed, never touches GitHub, no restore, no purge in v1).

Open questions that remain in `model.md` after this issue (each with its reason):
- [ ] Retention of the issue content of soft-deleted projects: their `issues` rows stay forever in v1 and can hold private-repository titles and bodies. (#490)
- [ ] Encryption at rest of issue content, and per-user quotas on projects and issues. (#490)
- [ ] The mechanism by which the future repository-removal feature learns that a live project uses a repository, without an import cycle (the rule and the read-only check are fixed here). Not decided: the removal feature is not built and has no issue yet.
- [ ] Link states and the unlinking action (#487); synced fields, conflict rules, staleness and retry values (#488): `model.md` only reserves the columns.

Fold step (#492): copy the repository-removal rule into `modules/repositories.md` (already commented there), and rewrite the statements in the fold table, asking the user before touching `CLAUDE.md` and `AGENTS.md`.
