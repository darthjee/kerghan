# Issues and Projects

Projects, the Kerghan issues that belong to them, and the optional one-to-one link of a Kerghan
issue to a GitHub issue, kept in sync both ways by background workers. Product decision: #483
(epic).

## Overview and purpose

Kerghan has **projects** (optionally connected to one repository) and **issues** that belong to a
project and may be linked one to one to a GitHub issue. The two sides are kept in sync both ways by
background workers (in-process, from #479). A project may be about code or anything else.

The feature persists Kerghan's own projects, issues, links and markers and, for a linked issue only,
a snapshot of its GitHub data. That is a narrow carve-out from
[product.md](../product.md)'s "fetched GitHub issue data is not persisted by default"; see the
[persistence statement](issues/data-model.md#persistence-statement).

> **Name collision.** `docs/agents/modules/issues/` holds this module's docs. It is unrelated to
> `docs/agents/issues/`, which holds issue drafts.

## Glossary

- **Project**: the home of issues. Owned by one user, private. Always Kerghan's project (an application backed by a repository, or a life/other project); the GitHub feature is always written "GitHub Project".
- **Issue** (Kerghan issue): a record that belongs to exactly one project.
- **GitHub issue**: an issue living on GitHub, in the repository linked to the project.
- **Link**: the optional one-to-one connection between a Kerghan issue and a GitHub issue.

## Scope

- **In scope:** the definition of the feature (model, projects, link, sync, API, security, UI, edge
  cases, testing).
- **Out of scope:** sharing, members and roles for projects (the design must not make them
  impossible later).

### Not built

- Labels on Kerghan issues (a follow-up).
- Sharing, members and roles for projects.
- A per-project issue number.
- Opt-in persistence of fetched issues for history and trends. It stays deferred and distinct from
  this feature.
- Removing an added repository once a project uses it (see [Open questions](#open-questions)).

## Open questions

- **Repository removal.** A future "remove an added repository" feature must refuse with `409` while
  a non-deleted project of the user uses the repository (the rule is also recorded in
  [Repositories](repositories.md#not-built)). How that feature learns that a live project uses a
  repository has no owner issue yet.

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
  issue; the GitHub issue must belong to the project's linked repository. Link creation is a synchronous read where GitHub's values win after confirmation; the link states are `linked`, `gone` and `sync_failed` plus derived ones; unlinking is explicit; a project's repository can change only while it has no links ([GitHub link](issues/github-link.md)).
- One `issues` module and four tables (`issues_projects`, `issues`, `issues_github_links`, `issues_pending_writes`); the link is its own table; project soft delete uses a `deleted_token`; a base snapshot supports conflict rules; outbound writes use a coalesced marker ([data model](issues/data-model.md)).
- Sync is two-way; fields, conflict rules and states are decided in [Sync](issues/sync.md).
- Workers: on-demand triggers only; outbound writes use a durable pending marker in the database
  re-enqueued at boot; rate limits reuse `retryAfterSeconds` with retry and cooldown, exhausted
  retries mark the link as sync failed; jobs receive ids only; credentials stay in the Integrations
  module.

## Index

| Doc | Read this when |
|---|---|
| [Data model](issues/data-model.md) | You need the four tables, constraints, ownership, the marker and its compare-and-clear rule, the stored GitHub data, cleanup contracts and lock order, or the persistence statement |
| [Projects](issues/projects.md) | You build or change projects: creation, the repository link, soft delete, the shortcut from an added repository |
| [GitHub link](issues/github-link.md) | You build or change linking: creating a link, attaching, the link states, unlinking, changing a project's repository |
| [Sync](issues/sync.md) | You build or change the workers: triggers, the marker lifecycle, conflict rules, integration selection, rate limits, retries, restart recovery |
| [Security](issues/security.md) | You touch access scoping, credentials, outbound GitHub calls, rendering of GitHub content, logging, or the checks the `security` and `data-access` agents apply |
| [Edge cases](issues/edge-cases.md) | The edge-case matrix: every case, its outcome and the rule behind it |
| [Frontend](issues/frontend.md) | You build or change the screens: lists, the issue page and forms, linking, sync states, the decisions behind them |
| [Testing](issues/testing.md) | You pick a test tier, build fixtures, or look for where the tests live |
| [Required tests](issues/required-tests.md) | You need the index of every required test and the spec that implements it |
| [Routes — Issues and Projects](../backend/routes/issues.md) | Routes, request/response contract, errors and validation, the GitHub-link and trigger routes |
