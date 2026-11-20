# Issues and Projects — Specs

Index of the **Issues and Projects** feature specs (epic #483). Part of the
[feature specs hub](../specs.md); while these files exist they are the **source of truth** for the
feature, and implementation issues read them instead of making their own decisions about the data
model, API, security or UI.

> **Name collision.** `docs/agents/specs/issues/` is the **spec folder** of this feature. It is
> unrelated to `docs/agents/issues/`, which holds issue drafts.

> **Supersedes `product.md`.** Until these specs are folded into the permanent docs, they
> supersede [product.md](../product.md)'s statement that issue data is not persisted by default:
> this feature persists Kerghan issues, projects and the link to GitHub issues. The statements to rewrite at fold time are listed in [issues/model.md](issues/model.md#persistence-statement-and-fold-list).

## Overview and purpose

Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a
project and may be linked one to one to a GitHub issue. The two sides are kept in sync both ways by
background workers (in-process, from #479). A project may be about code or anything else.

## Glossary

- **Project**: the home of issues. Owned by one user, private. Always Kerghan's project (an application backed by a repository, or a life/other project); the GitHub feature is always written "GitHub Project".
- **Issue** (Kerghan issue): a record that belongs to exactly one project.
- **GitHub issue**: an issue living on GitHub, in the repository linked to the project.
- **Link**: the optional one-to-one connection between a Kerghan issue and a GitHub issue.

## Scope

- **In scope (this spec set):** the definition of the feature (model, projects, link, sync, API,
  security, UI, edge cases, testing).
- **Out of scope now:** implementation (the sub-issues of #483 spawned by #492, listed under [Implementation issues](#implementation-issues)); sharing, members and roles for projects
  (the specs must not make them impossible later).

## Product decisions

- A project is the home of issues; every Kerghan issue belongs to exactly one project.
- A project has 0 or 1 linked repository (one of the user's repository rows); no repository means a
  non-code project. At most one project per repository per user, among non-deleted projects.
- Deleting a project soft-deletes the project row (a tombstone) and hard-deletes its issues, links and markers; it frees its name, repository and GitHub links, and never
  touches GitHub.
- A project has one owner, is private, and another user's project answers 404.
- Creation is explicit (optionally picking an added repository, the only way to make a non-code
  project), plus a shortcut that creates a project from an added repository.
- A Kerghan issue links one to one to a GitHub issue, per user (unique on user and GitHub issue);
  the link is optional, created from a GitHub issue or by attaching one to an existing Kerghan
  issue; the GitHub issue must belong to the project's linked repository. Link creation is a synchronous read where GitHub's values win after confirmation; the link states are `linked`, `gone` and `sync_failed` plus derived ones; unlinking is explicit; a project's repository can change only while it has no links ([issues/github-link.md](issues/github-link.md)).
- One `issues` module and four tables (`issues_projects`, `issues`, `issues_github_links`, `issues_pending_writes`); the link is its own table; project soft delete uses a `deleted_token`; a base snapshot supports conflict rules; outbound writes use a coalesced marker ([issues/model.md](issues/model.md)).
- Sync is two-way; fields, conflict rules and states are decided in the enhancement issues.
- Workers: on-demand triggers only; outbound writes use a durable pending marker in the database
  re-enqueued at boot; rate limits reuse `retryAfterSeconds` with retry and cooldown, exhausted
  retries mark the link as sync failed; jobs receive ids only; credentials stay in the Integrations
  module.

## Index

| File | Concern | Open questions |
|---|---|---|
| [issues/projects.md](issues/projects.md) | Projects | [open](issues/projects.md#open-questions) |
| [issues/model.md](issues/model.md) | Data model | [open](issues/model.md#open-questions) |
| [issues/github-link.md](issues/github-link.md) | GitHub link | [open](issues/github-link.md#open-questions) |
| [issues/sync.md](issues/sync.md) | Two-way sync and workers | [decided](issues/sync.md#open-questions) |
| [issues/api.md](issues/api.md) | API | [decided](issues/api.md#open-questions) |
| [issues/security.md](issues/security.md) | Security | [decided](issues/security.md#open-questions) |
| [issues/ui.md](issues/ui.md) | UI | [decided](issues/ui.md#open-questions) |
| [issues/edge-cases.md](issues/edge-cases.md) | Edge-cases matrix | [open](issues/edge-cases.md#open-questions) |
| [issues/testing.md](issues/testing.md) | Test strategy | [decided](issues/testing.md#open-questions) |

## Lifecycle

Lifecycle and conventions: [specs.md](../specs.md). Order of the epic's work: #484, #485 to #491,
#493, #494, then #492 (which spawns the implementation and the issue that folds these specs into
the permanent docs). Each open question names the issue that owns it.

## Implementation issues

Spawned by #492 as native sub-issues of #483; each builds against the spec files named in its body.
They are also set as GitHub "blocked by" relationships.

| Issue | Area (agent) | Builds against | Waits for |
|---|---|---|---|
| #553 | Foundation (`backend`) | `model.md`, `security.md`, `testing.md` | none |
| #554 | GitHub issue client (`backend`) | `sync.md`, `security.md`, `testing.md` | none |
| #555 | Projects API (`backend`) | `projects.md`, `api.md`, `api/projects.md`, `api/errors-and-validation.md` | #553 |
| #556 | Issues API (`backend`) | `api/issues.md`, `model.md`, `security.md` | #555 |
| #557 | GitHub link (`backend`) | `github-link.md`, `api/github-link.md`, `edge-cases.md` | #554, #556 |
| #558 | Sync workers (`backend`) | `sync.md`, `model.md` | #554, #557, #479 (closed) |
| #559 | Security verification (`backend`) | `security.md`, `testing.md`, `api.md`, `edge-cases.md` | #558 |
| #560 | Frontend 1 (`frontend`) | `ui/screens-and-flows.md`, `ui/decisions.md` | #555 |
| #561 | Frontend 2 (`frontend`) | `ui/screens-and-flows.md`, `ui/decisions.md`, `security.md` | #556, #560 |
| #562 | Frontend 3 (`frontend`) | `ui/linking-and-sync.md`, `ui/states.md` | #557, #558, #561 |
| #563 | Open-issue counts and bulk close/reopen (`backend`, `frontend`) | `api.md` as amended by #507, `ui/states.md` | #507, #556, #561 |
| #564 | Fold the specs into the permanent docs (`architect`), last | `model.md`, `specs.md` | all of the above and #507 |
