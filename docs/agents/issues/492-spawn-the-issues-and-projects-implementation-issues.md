# Issue: Spawn the Issues and Projects implementation issues

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`), and the specification phase is finished. This issue turns those specs into implementation work by spawning sub-issues. It is documentation and issue-tracking only: no code, migrations or endpoints are added by it.

Responsible agent: `architect`. This issue closes the specification phase of the epic.

## Problem

The specs are complete but nothing builds them yet. The implementation has to be broken into issues that are grouped by area and owning agent, ordered by their dependencies, and that each name the spec files they build against. The specs also have to be folded into the permanent docs once the feature is built, and then removed, per the lifecycle in `docs/agents/specs.md`.

## Expected Behavior

- Every spec file under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/` is covered by at least one implementation issue, and each implementation issue names the spec files it builds against.
- The implementation issues are ordered and their dependencies are written down: in each body, and as GitHub "blocked by" relationships where available.
- The sub-issues are attached to the epic #483 as native sub-issues, beside the spec issues #484 to #494.
- Each implementation issue ships the Required tests of the spec files it builds against.
- The last issue (fold into the permanent docs and remove the specs) exists and comes last.
- The sync workers issue records its dependency on #479 (background workers). #479 is closed, so the dependency is already satisfied.
- No code, migrations or endpoints are added by this issue itself.

## Solution

Spawn the following sub-issues with the split tooling, in this order (the number is the order of creation; "waits for" refers to other rows):

| # | Area / owning agent | Builds against | Waits for |
|---|---|---|---|
| 1 | **Foundation** (`backend`): the `issues` module, the four entities and their migrations, config keys, the `user.deleted` cleanup, the single access check, DB seed builders | `model.md`, `security.md` (data at rest, logs), `testing.md` (fixtures) | none |
| 2 | **GitHub issue client** (`backend`, Integrations module): `getIssue`, `probeIssues`, `IntegrationsGithubIssueWriter.updateIssue`, the GitHub App `issues: write` permission with per-operation tokens, the redirect host check, the extended fake and the fidelity and redirect contract specs | `sync.md` (GitHub issue client operations), `security.md` (write access, the Integrations boundary), `testing.md` (fixtures) | none (parallel to 1) |
| 3 | **Projects API** (`backend`): the project routes, creation paths, repository change and detach, delete, the projects cap, the error catalogue | `projects.md`, `api.md`, `api/projects.md`, `api/errors-and-validation.md` | 1 |
| 4 | **Issues API** (`backend`): list, create, edit, delete, the issues cap, the edit rate limit, the marker upsert on edit | `api/issues.md`, `model.md` (marker), `security.md` (quotas) | 3 |
| 5 | **GitHub link** (`backend`): import, attach with the E61 confirmation, unlink, the same-repository rule, the link object and its derived states | `github-link.md`, `api/github-link.md`, `edge-cases.md` (E57 to E65) | 2, 4 |
| 6 | **Sync workers** (`backend`): the `issues.reconcile` job, triggers T1 to T6, rate limits, retries and `sync_failed`, integration selection, boot re-enqueue, staleness, the refresh and retry-sync routes | `sync.md`, `model.md` (marker lifecycle) | 2, 5, and #479 (closed, satisfied) |
| 7 | **Security verification** (`backend`, reviewed by `security`, `data-access` and `cache`): route access matrix, canary sweeps, static specs, cache-policy coverage, the review checklists | `security.md`, `testing.md`, `api.md`, `edge-cases.md` | 6 |
| 8 | **Frontend 1** (`frontend`): API client, routes, header link, project list, creation, management | `ui/screens-and-flows.md`, `ui/decisions.md` | 3 |
| 9 | **Frontend 2** (`frontend`): issue list, issue page and forms, the restricted-Markdown `IssueBody` | `ui/screens-and-flows.md`, `ui/decisions.md`, `security.md` (bodies) | 4, 8 |
| 10 | **Frontend 3** (`frontend`): linking and sync states, the link panel, import, attach, unlink, the bounded re-reads | `ui/linking-and-sync.md`, `ui/states.md` | 5, 6, 9 |
| 11 | **Open-issue counts and bulk close/reopen** (`backend` and `frontend`) | the `api.md` amended by #507, `ui/states.md` (scope) | #507, 4, 9 |
| 12 | **Last: fold the specs into the permanent docs** (`architect`): `product.md`, `modules/`, `backend/routes/`, `environment-variables.md` and the fold list of `model.md`; update the product-owner map of decided areas; propose the `AGENTS.md` and `CLAUDE.md` edits and ask before touching them; copy the repository-removal rule into `modules/repositories.md`; delete `docs/agents/specs/issues.md` and `docs/agents/specs/issues/`; move the entry in `docs/agents/specs.md` from *Active specs* to *Completed specs* | `model.md` (persistence statement and fold list), `specs.md` (lifecycle) | all of the above, including #507 |

Notes:

- Rows 1 and 2 can start at once; the rest follow the "waits for" column.
- The spec files `edge-cases.md`, `testing.md` and `security.md` are cross-cutting: each implementation issue builds against the rows that concern it, and row 7 closes what is left.
- The open question of `model.md` (how the future repository-removal feature learns that a live project uses a repository) has no owner issue and is out of scope for these sub-issues; row 12 only copies the rule.

## Benefits

- The feature can be built in small, reviewable, parallelizable pieces, each owned by one agent.
- Specs and implementation stay traceable: every spec file maps to the issues that build it.
- The spec phase ends cleanly with a last issue that leaves only permanent docs behind.
