# Plan: Enhance the Issues specs: security

Issue: [490-enhance-the-issues-specs-security.md](../../issues/490-enhance-the-issues-specs-security.md)

## Overview

Documentation only. Rewrite `docs/agents/specs/issues/security.md` with every decision in the issue's Solution section and close its four open questions, then apply the consistency edits listed in the issue's Scope boundaries to the other spec files in the same PR. No code, migrations, DTOs, `ErrorCodes`, frontend dependency or permanent docs (`architecture/security.md`, `modules/integrations/*`, `environment-variables.md`) change.

## Context

`security.md` holds principles and four open questions owned by #490; `api.md`, `model.md`, `sync.md`, `github-link.md` and `testing.md` defer the same questions to it. The issue's Solution section is the source for every decision. Follow the conventions of the spec set ([specs.md](../../specs.md)): specs describe decisions, not code; every file keeps its "Open questions" and "Required tests" sections up to date; `edge-cases.md` ids stay stable.

## Steps

- [01 — Rewrite security.md](plan/01-rewrite-security-md.md)
- [02 — Update sync.md and github-link.md](plan/02-update-sync-and-link.md)
- [03 — Update model.md, projects.md and api.md](plan/03-update-model-projects-api.md)
- [04 — Update testing.md, edge-cases.md, ui.md and issues.md](plan/04-update-remaining-specs.md)

## Notes

- No CI job covers `docs/`; check by hand that every relative link and anchor resolves and that no "(#490)" open question remains in any spec file.
- Links in the issue file start with `../specs/issues/` and `../architecture/`; inside `docs/agents/specs/issues/` they become sibling links and `../../architecture/…`, `../../modules/…`.
- #505 (refreshing the `security` and `data-access` agents) is separate; `security.md` only references it.
- Deferred and not owned (no issue): encryption of issue content, restore or purge of deleted projects, syntax highlighting, autolinking `@mentions`/`#references`, image proxying. Record them as "Not decided" in `security.md`, not as open questions.
