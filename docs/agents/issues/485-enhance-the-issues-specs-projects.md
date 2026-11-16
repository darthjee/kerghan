# Issue: Enhance the Issues specs: projects

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is first defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`). This issue is documentation only: no code, migrations or endpoints.

It enhances `docs/agents/specs/issues/projects.md`, created by the first sub-issue (#484, merged). A "project" is a Kerghan application (backed by a repository) or a life/other project (no repository). It is **not** a GitHub Project.

## Problem

`projects.md` records only the decisions made in the epic and lists five open questions (repository cardinality, fields, repository removal, deletion, room for sharing). An implementation issue cannot build against it without making its own decisions about projects, creation, deletion or the repository link.

## Expected Behavior

`projects.md` states every decision below precisely enough that an implementation issue needs no decision of its own. It has no unresolved open question, except those listed as explicitly not decided with a reason and an owner issue. Its "Required tests" section matches its rules, and the other spec files carry short consequence bullets pointing to it.

## Solution

Edit `docs/agents/specs/issues/projects.md` and record these decisions (routes, payloads and error codes stay with #489, columns and types with #486, sync mechanics with #488, UI with #491).

**Naming.** The concept keeps the name "project". In the specs, "project" always means Kerghan's; the GitHub feature is always written in full as "GitHub Project". No Kerghan-side term is coined for GitHub Projects (out of scope for the epic).

**Cardinality.** One repository backs at most one project per user: unique on (user, repository) among non-deleted projects, nullable for non-code projects (several projects with no repository are allowed).

**Fields.** `name` is required, trimmed, 1 to 100 characters (counted in characters), unique per user case-insensitively among non-deleted projects (`409` on a duplicate); a blank name is a validation error. `description` is optional, trimmed plain text of at most 2000 characters, never rendered as markup; an empty or whitespace-only description is stored as none. Repository link: optional, 0 or 1. Owner: the session's user, never taken from the request. Timestamps. A deletion marker (see deletion). No status or archive state in v1. The read model adds a repository summary (owner, name, private and the row status Added/Unavailable/Unknown), derived on read and never stored on the project; no issue counts or sync info in v1.

**Creation paths.**
- *Explicit:* name, optional description, optional repository. A repository must be one of the caller's own repository rows with `added_at` set, in any derived status (Added, Unavailable, Unknown are all allowed). A row that is not added, belongs to another user or does not exist is rejected without revealing that it exists. A repository that already has a project of the user is rejected with `409`, pointing at the existing project. A taken name is `409`. This is the only way to make a non-code project.
- *Shortcut* (from an added repository): takes a repository reference plus an optional `name` and `description`. A repository that is not added is rejected (`409`); the shortcut never adds one. If the user already has a project on the repository it returns it (`200`, ignoring `name` and `description`), otherwise it creates one (`201`). The default name is `owner/name` from the repository's latest snapshot, and a name collision answers `409` (no automatic suffix).
- *Both:* creation is a pure database write; it never enqueues a job or calls GitHub (the first import or sync is a separate, explicit, on-demand action). Both paths share one service method.

**Linked repository unavailable or removed.** A project never loses its repository automatically. Local work (reading and editing issues) continues whatever the status. GitHub sync is refused while the repository is Unavailable and allowed while it is Unknown; pending writes stay in their markers under the normal retry and sync-failed rules (#488). A dangling repository reference reads like an Unavailable repository with no summary fields. The future "remove an added repository" feature (not built) must refuse with `409` while a non-deleted project of the user uses the repository; #492 is told to copy that rule into `modules/repositories.md`. If the integration is deleted, the project is unaffected directly. If the user is deleted, their projects (including soft-deleted ones), issues, links and markers are removed for real (mechanism: #486, #493).

**Deletion.** Soft delete: the project gets a deletion timestamp. A deleted project answers `404` for every read or write and is excluded from listings, like another user's project; its issues are kept in the database but are unreachable through the API. Uniqueness of name and repository covers only non-deleted projects, so both can be reused after deletion (how it is enforced in MySQL is for #486). The project's GitHub links are deleted on deletion, which frees their GitHub issues for another project. Pending markers are discarded; queued or in-flight jobs for a deleted project or user are a no-op (no error, no retry). The confirmation warns that unsent changes will not be written to GitHub, and the response says how many issues had them. Deletion never makes a GitHub call. No restore and no purge in v1.

**Changing a project later.** Name and description can be edited under the creation rules. A repository can be attached to a project that has none (same checks as creation; it never syncs). Changing to another repository, or detaching, is refused in v1 (`409`); issues cannot be moved between projects in v1.

**Room for sharing, members and roles.** No schema, endpoint or concept for them in v1. Guardrails: (1) one service-level access check for every project or issue read or write (today owner only, otherwise `404`), with no scattered `user_id` filters; (2) issues derive access from their project and carry no authorization owner; (3) the owner's credentials do all GitHub work, whoever triggers it, and the link uniqueness stays per owner; (4) the actor is not assumed to equal the owner. An explicit "not decided" list covers members and roles, invitations, ownership transfer, shared visibility, and a member's view when the owner's integration is revoked.

**Edge cases** (a short section in `projects.md`; `edge-cases.md` gets a pointer line for each):
- Two simultaneous creations on one repository: the database uniqueness decides; the loser answers `409` on the explicit path, and the shortcut re-reads and returns the winner (`200`).
- Two simultaneous creations or renames to one name: one wins, the other `409`.
- Create or attach on a repository that has only a deleted project: allowed.
- Repository renamed or transferred on GitHub: nothing happens to the project; its name is just text and the summary shows the current `owner/name`.
- Repository goes Unavailable and returns: the project is untouched; sync is refused only while Unavailable.
- Repository added but Unavailable at creation: allowed.
- Job or request for a deleted project or user: a job is a no-op, a request answers `404`.

**Other spec files** get short consequence bullets pointing to `projects.md`, never design of their own: `model.md` (soft deletion marker, uniqueness among non-deleted rows, user deletion), `github-link.md` (the GitHub issue must belong to the project's repository; links released on deletion), `sync.md` (gating by repository status, creation never syncs, no-op jobs, discarded markers), `api.md` (behaviors only: `200`/`201`, `409` cases, `404`), `security.md` (the sharing guardrails), `ui.md` (deletion confirmation and the repository status), `edge-cases.md` and the `issues.md` index (the project vs GitHub Project note).

**Required tests** in `projects.md` are the union of the tests of these rules, one per rule: ownership and `404`; creation paths and their `200`/`201`/`409` outcomes; repository eligibility; name and description rules; uniqueness among non-deleted projects; soft-deletion effects (`404`, listings, reuse of name and repository, links released, markers discarded, no-op jobs, no GitHub call, removal on user deletion); attach-only repository changes; the single access check; owner credentials; the concurrency cases. Test tiers and fixtures stay with #494.

## Benefits

- Implementation issues for projects build against one precise definition.
- The decisions that touch other specs are visible to their owner issues (#486 to #494) without rereading this one.
- Sharing and members remain possible later without a redesign.

## Acceptance criteria

- `projects.md` has no unresolved open question, or lists any remaining one with the reason and the owner issue. Items left explicitly "not decided": members and roles, invitations, ownership transfer, shared visibility, archive status, restore and purge of deleted projects, issue moves, change or detach of a repository while no links exist.
- The "Required tests" section matches the rules in the file.
- The consequence bullets above are added to the other spec files, each pointing to `projects.md`, with no design of those files' own content.
- No code, migrations, endpoints or permanent docs are changed.

## Notes

- Responsible agent: `architect`. Depends on the first sub-issue (#484), which is merged.
- Performance: no impact (docs only). The project list is small and unpaginated in v1 (pagination is for #489 if needed); no per-user project cap in v1.
- Security: projects are owner-scoped; the specs contain no real tokens, personal data or private repository names.
- Backward compatibility: no projects or issues exist today, so nothing is migrated and no project is created automatically for already added repositories. `product.md`'s "issue data is not persisted" line changes only at fold time (#492).
