# Feature Specs

Permanent hub for **feature specs**: temporary, agreed definitions of a multi-issue feature that
its implementation sub-issues build against. This hub is never deleted; the feature folders it
lists are.

## Purpose

`docs/agents/specs/<feature>/` holds one feature's definition while its sub-issues are being
built. While the folder exists, it is the **source of truth** for that feature: implementation
issues read it instead of making their own decisions about the data model, API, security or UI.

A spec folder is not a plan (`plans/` holds per-issue implementation steps) and not an issue
file (`issues/` holds one issue's description). It is the shared definition several issues and
plans point at.

## Lifecycle

1. A feature's **first** sub-issue writes the specs under `docs/agents/specs/<feature>/` and adds
   an entry to [Active specs](#active-specs) below.
2. The implementation sub-issues build against the specs. A sub-issue that changes a decision
   updates the spec in the same PR.
3. The feature's **last** sub-issue folds the lasting content into the permanent docs
   (`product.md`, `modules/`, `backend/routes/`, `environment-variables.md`, …).
4. That last sub-issue then deletes `docs/agents/specs/<feature>/` and moves its entry from
   [Active specs](#active-specs) to [Completed specs](#completed-specs), pointing at the permanent
   docs that now hold it.

This hub itself is never deleted, even when no spec is active.

Root instruction files (`CLAUDE.md`, `AGENTS.md`) link to this hub, never to a feature's spec
folder or to the permanent docs it was folded into. When a spec moves or completes, only this
file changes.

## Conventions

- **One `README.md` per feature**: overview, purpose, scope, the product decision behind it, and
  an index linking every other file in the folder.
- **Files split by concern** (e.g. `model.md`, `api.md`, `security.md`, `ui.md`), so each
  implementation issue reads only what it needs.
- **Per-variant files in a subfolder** (e.g. `types/<type>.md`), each added by its own sub-issue.
- **A "Required tests" section** at the end of each spec file, next to the rules it verifies.
- Specs describe decisions, not code. They name existing code only to point at a convention to
  follow.

## Active specs

none

When no feature is in progress, this list reads "none".

## Completed specs

Features whose specs were folded into the permanent docs, and where their definition lives now.

| Feature | Now defined in | Product decision |
|---------|----------------|------------------|
| Integrations (GitHub credentials) | [modules/integrations.md](modules/integrations.md) (encryption at rest: its *Security* section) | #295 |
