# Issues and Projects — Data model

The tables, constraints, pending marker and cleanup contracts of the feature.
Part of the [Issues and Projects specs](../issues.md).

## Overview and module layout

- One `issues` module owns projects and issues, so the single access check, the soft-delete cascade and the sync live together (no separate `projects` module).
- Four tables, named as Repositories does (main table named after the module, the others prefixed): `issues_projects`, `issues`, `issues_github_links`, `issues_pending_writes`.
- Conventions: `int` auto-increment `id`; plain `int` `user_id` (logical FK to `auth_users.id`); explicit `varchar` lengths; `datetime` columns; index names `idx_<table>_<cols>`; timestamps from the injected `Clock` (never `NOW()` in SQL). All foreign keys are logical (no physical constraints), as in Repositories.
- A project's repository is `repository_id`, a logical FK to `repositories.id`; the summary is read through Repositories' exported service, never a join.
- Ownership is by user; issues derive access from their project ([security.md](security.md)).
- This feature persists issue data, which supersedes `product.md`'s "not persisted by default" statement (see [Persistence statement and fold list](#persistence-statement-and-fold-list)).
- The GitHub link is a separate table: the optional one to one is a row existing or not, unlinking and project deletion are row deletes, and link states and cached GitHub data can grow without widening `issues`.
- Project fields and rules (name, description, repository, deletion) are in [projects.md](projects.md#fields); this file gives their columns.

## `issues_projects`

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

- **Uniqueness among live projects.** MySQL has no partial unique index, so two plain unique indexes are used: (`user_id`, `name`, `deleted_token`) and (`user_id`, `repository_id`, `deleted_token`). Live rows collide, deleted rows never do, and a `NULL` repository never collides. No raw SQL, so migrations keep the `Table`/`TableIndex` style. The database decides simultaneous creations. `deleted_at` and `deleted_token` are always written together.
- **Case and accents.** Case-insensitivity comes from the default `utf8mb4_0900_ai_ci` collation, which is also accent-insensitive: names differing only by case or accents are duplicates (the same reliance as Auth's default-user lookup and Repositories' `fullName` lookup).

## `issues` (Kerghan issues)

| Column | Type | Notes |
|---|---|---|
| `id` | `int` auto-increment | The issue's reference. |
| `project_id` | `int` | Logical FK to `issues_projects.id`. |
| `title` | `varchar(256)` | Required; 256 is GitHub's title limit. |
| `body` | `mediumtext NULL` | Application cap of 65536 characters (GitHub's body limit); `text` is too small for that many utf8mb4 characters. Blank stored as `NULL`. |
| `state` | `varchar(16)` | `open` or `closed`, default `open`. |
| `created_at`, `updated_at` | `datetime` | |

- **No `user_id` on issues.** Access and cleanup go through the project (issues derive access from their project and carry no authorization owner).
- No per-project issue number in v1 (the `id` is the reference), and no `created_by` (the actor is the owner in v1).
- Deleting a single issue is a hard delete, if the API offers it ([#489](api.md#open-questions) decides); its link and marker go with it, and GitHub is never touched.
- **Labels are not in v1.** Only title, body and state are stored, so #488 may only sync those three fields. Adding another field (labels, assignees, milestone, comments, reactions) means adding its column or table to this file in the same PR. Labels are a follow-up with their own table and sync rules.

## `issues_github_links`

| Column | Type | Notes |
|---|---|---|
| `id` | `int` auto-increment | |
| `user_id` | `int` | The project owner, denormalised for the uniqueness rule only, never for authorization. |
| `issue_id` | `int` | Logical FK to `issues.id`; unique, so an issue has at most one link. |
| `github_issue_id` | `bigint` | GitHub's global issue id, the stable key; unique with `user_id`. Mapped to a JS number with a `from: Number` transformer, as Repositories does for `github_id`. |
| `github_number` | `int` | The number inside the repository, for display and API calls (owner and name come from the project's repository row). |
| `status` | `varchar(32)` | The link state. Values are owned by #487 and #488; this spec only fixes that the column exists and that `sync_failed` is one of the values. |
| `base_title`, `base_body`, `base_state` | `varchar(256)`, `mediumtext NULL`, `varchar(16)` | The values as last synced (the **base snapshot**), so #488 can tell which side changed which field. If #488 picks plain last-write-wins it may drop them in its own PR. |
| `github_updated_at`, `last_synced_at` | `datetime NULL` | GitHub's `updated_at` as last seen; the last successful sync. |
| `etag` | `varchar(255) NULL` | For conditional requests. |
| `created_at`, `updated_at` | `datetime` | |

- No `repository_id` on the link: the project's repository cannot change in v1, and the repository check happens when the link is created.
- The link is for issues only; GitHub's issues endpoint also returns pull requests, and refusing or ignoring them is #487's rule. If a transfer changes an issue's id or number, #487 settles it.
- Any column #487 or #488 needs is added to this file in the same PR.

## `issues_pending_writes` (the pending marker)

| Column | Type | Notes |
|---|---|---|
| `id` | `int` auto-increment | |
| `link_id` | `int` | Logical FK to `issues_github_links.id`; unique, so one marker per link. |
| `revision` | `int` | Starts at 1; bumped by every edit of a synced field. |
| `marked_at` | `datetime` | Set when first created; the boot re-enqueue goes oldest first. |
| `updated_at` | `datetime` | Time of the last local edit of a synced field; used by the conflict rule E7 of [edge-cases.md](edge-cases.md). |

- **Only linked issues get markers** (the epic has no "create a GitHub issue from a Kerghan issue" path). An edit of an unlinked issue creates none, and an edit that changes no value creates no marker and bumps no revision (E12).
- **Coalesced, no payload.** An edit does `INSERT … ON DUPLICATE KEY UPDATE revision = revision + 1`, in the same transaction as the issue update. The job diffs the current issue against the base snapshot to learn what to push.
- **Compare-and-clear.** A job reads the revision, pushes, then in one transaction updates the base snapshot (with the values pushed) and deletes the marker `WHERE link_id = ? AND revision = ?`. If no row is deleted, an edit landed during the push and the job re-enqueues itself.
- **Attempts are in memory** (retry and cooldown, from #479); after a restart the marker is re-enqueued fresh. Exhausted retries set the link `status` to `sync_failed` and keep the marker.
- **Boot.** Every marker is re-enqueued by `link_id`, oldest first (ids only; no credentials or content in job params or logs). Inbound refresh has no marker (it is on demand).
- Cleanup needs no `user_id` on the marker: user cleanup goes marker, then link (links carry `user_id`); project deletion goes through the project's issues.

## Indexes

| Table | Index | Serves |
|---|---|---|
| `issues_projects` | unique (`user_id`, `name`, `deleted_token`) | Name uniqueness among live projects; the user's listing by name; lookups by name. |
| `issues_projects` | unique (`user_id`, `repository_id`, `deleted_token`) | Repository uniqueness among live projects; the shortcut's existing-project lookup; the future repository-removal refusal. |
| `issues` | (`project_id`, `state`) | Listing a project's issues, optionally by state. |
| `issues_github_links` | unique (`user_id`, `github_issue_id`) | The link rule; its leftmost column also covers user cleanup. |
| `issues_github_links` | unique (`issue_id`) | At most one link per issue; issue-to-link lookup; project cleanup. |
| `issues_pending_writes` | unique (`link_id`) | One marker per link; marker lookup from a job. |

- The "live project" predicate is `deleted_token = 0` (not `deleted_at IS NULL`), so reads use the unique indexes.
- Not added on purpose: a separate index on `issues_projects.user_id` (the unique indexes cover it), any index on the marker table (it holds only unsent changes), and one for "links by status" (#487 and #488 add one if needed). The issues listing index is minimal: #489 decides the sort and adds a sort index in the same PR if needed.
- The longest index name is 55 characters, under MySQL's 64.

## Cleanup

- **Lock order.** Every multi-table write in the module locks projects, then issues, then links, then markers, so cleanups never deadlock with a running job or a project deletion.
- **`user.deleted`** (an awaited event after the user-row delete commits; nothing emits it yet). The Issues module listens, as Repositories does. One transaction deletes the markers (through links), the links by `user_id`, the issues (through the user's projects) and the user's projects, including soft-deleted ones. A failure is logged at error level with safe fields (`userId`, error class) and never blocks the deletion; a future deletion path must retry the event or run an orphan sweep. Creating a project re-reads the user through Auth's export (`lockExistingUser`) in the same transaction, so no orphan is created for a user deleted a moment earlier. A job after the delete only updates or deletes guarded rows and never inserts.
- **`integration.deleted`: no hook.** Nothing in the module stores an integration id; the owner's integrations are resolved at job time through the Integrations module. If none is usable the job follows #488's no-credential rule and the markers stay.
- **Project deletion (soft)**, one transaction: count the project's issues that have markers (the number the response reports), set `deleted_at` and `deleted_token`, delete the markers and the links of its issues. The `issues` rows stay, unreachable, with no purge in v1.
- **Single issue deletion:** marker, link, then the issue, in lock order.
- **Repository removal (not built).** It must refuse with `409` while a live project of the user uses the repository. A project requires `added_at`, so its repository row is never pruned; a dangling `repository_id` reads as Unavailable. The spec fixes the rule and a read-only check the Issues module exposes ("does a live project of this user use repository X?"). Because Issues already depends on Repositories, the removal feature must not create an import cycle; the mechanism is chosen when that feature is built (not decided, no owner issue yet).

## Persistence statement and fold list

The persistence statement is a narrow carve-out. At fold time (#492): keep "fetched GitHub issue data is not persisted by default" for the existing live listing; add that Kerghan persists its own projects, issues, links and markers and, only for a linked issue, a snapshot of its GitHub data, with the backend reading and writing GitHub for linked issues with the owner's credentials inside the Integrations module as an explicit, narrow exception to "read by the browser". "Opt-in issue persistence" (fetched issues for history and trends) stays deferred and distinct.

Statements to rewrite at fold time:

| File | Statement |
|---|---|
| `docs/agents/product.md` | "What the backend persists", "Issue fetching model", "GitHub access", and the two Deferred items. |
| `AGENTS.md` | The project overview and the "lightweight account" bullet. |
| `CLAUDE.md` | Boundaries: "Issue fetching itself still reads GitHub unauthenticated…". |
| `docs/agents/architecture/security.md` | "GitHub credentials stay in the backend". |
| `docs/agents/summary.md`, `docs/agents/flow.md` | Where they say issue data is never persisted or only read by the browser. |

`AGENTS.md` and `CLAUDE.md` hold the user's own rules: #492 proposes the edit and asks before touching them. #492 also copies the repository-removal rule into `modules/repositories.md` (already commented there).

## Alternatives considered

| Alternative | Why not |
|---|---|
| Two modules (projects, issues) | The access check and the deletion cascade would cross a module boundary. |
| Link as nullable columns on `issues` | Widens `issues`; unlinking and project deletion become updates, and link states and cached data crowd the table. |
| Generated columns or a functional unique index for uniqueness | Raw SQL and TypeORM workarounds, no precedent; an application-only check cannot decide simultaneous creations. |
| Denormalised `user_id` on issues | A second copy of ownership, against the single-access-check guardrail. |
| Labels now | Forces a two-way label sync design first. |
| Repository plus number as the GitHub key | Breaks if the number changes. |
| Timestamps only for conflicts | One whole edit overwrites the other; the base snapshot allows per-field decisions. |
| Marker as columns on the link | Edits and inbound sync would write one row. |
| Marker derived from the snapshot diff | An unindexed scan, and no revision for compare-and-clear. |
| A marker row per change with a payload | An unbounded queue. |
| Physical foreign keys | Break the module pattern (Repositories uses logical FKs). |
| Kerghan issues as a pure cache of GitHub issues | A project with no repository, or an issue with no link, could not exist. |

## Edge cases

Each row is also a required test. The cross-file matrix is [edge-cases.md](edge-cases.md); these rows are indexed there as E41 to E56.

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

## Scope boundaries

- **In scope:** the four tables, constraints and indexes; the logical FKs and ownership; the marker and its compare-and-clear rule; the stored GitHub data and the fold list; the cleanup contracts and lock order; the required tests.
- **Owned elsewhere:** routes, payloads and the issues listing sort (#489); link states, unlinking and transfers (#487); synced fields, conflict rules, staleness and retry values (#488); encryption at rest of issue content, retention of soft-deleted projects and quotas (#490); UI (#491); code and migrations (spawned by #492).
- **Not stored in v1:** labels, assignees, milestones, comments and reactions; a per-project issue number; `created_by`; an audit of edits; any schema for sharing, members or roles.

## Backward compatibility

- All four tables are new; no existing table changes and no data is migrated or backfilled (existing users start with no projects; adding a repository never creates one).
- Migrations are named `<timestamp>-issues-<action>.ts`, create the tables in the order above, and `down` drops them in reverse.
- No existing endpoint changes. Rolling back means dropping the tables (the feature is not released yet).

## Performance and security

- Every query is on an index above and bounded to one user's or one project's rows; the marker table is the only unindexed scan, and it holds only unsent changes.
- A body is capped at 65536 characters, and a linked issue keeps one extra copy (the base snapshot).
- No secret sits in these tables, and job params and logs carry ids only.
- Every access goes through the project's single access check; the link's `user_id` is for uniqueness only.
- Issue content of private repositories is stored unencrypted, as Repositories stores private metadata; encryption, retention and quotas are #490's.

## Open questions

- [ ] Retention of the issue content of soft-deleted projects: their `issues` rows stay forever in v1 and can hold private-repository titles and bodies. (#490)
- [ ] Encryption at rest of issue content, and per-user quotas on projects and issues. (#490)
- [ ] The mechanism by which the future repository-removal feature learns that a live project uses a repository, without an import cycle (the rule and the read-only check are fixed here). Not decided: the removal feature is not built and has no issue yet.
- [ ] Link states and the unlinking action (#487); synced fields, conflict rules, staleness and retry values (#488): this file only reserves the columns.

## Required tests

All in the DB-backed tier (uniqueness, concurrency and transactions need real MySQL), as Repositories; the tier table, seed builders, intruder user and the restart spec are in [testing.md](testing.md#tiers).

- The three unique constraints are enforced: (`user_id`, `github_issue_id`) on links, `issue_id` on links, `link_id` on markers.
- Project name and repository are unique among non-deleted projects only; `deleted_at` and `deleted_token` are always written together, and a `NULL` repository never collides.
- Names differing only by case or accents are duplicates.
- Compare-and-clear: a changed revision deletes no row and the job re-enqueues itself; an unchanged one clears the marker and updates the base snapshot.
- An edit of a linked issue upserts the marker in the same transaction; an edit of an unlinked issue creates none.
- Boot re-enqueues every marker once, oldest first, by `link_id` (the restart spec of [testing.md](testing.md#worker-tests)).
- Cleanup contracts: `user.deleted` removes markers, links, issues and projects (including soft-deleted) in lock order, and a listener failure is logged without blocking; project soft delete removes markers and links and keeps the `issues` rows; single issue deletion removes marker, link, then the issue.
- utf8mb4 (a 4-byte character) and `bigint` (an id above 2³¹) round-trip.
- The migration `up` creates the four tables and `down` drops them in reverse.
- A two-user baseline: one user never sees or changes another's rows.
- One test per row of the [edge-case table](#edge-cases).
