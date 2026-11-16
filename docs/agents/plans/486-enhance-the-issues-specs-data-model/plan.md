# Plan: Enhance the Issues specs: data model

Issue: [486-enhance-the-issues-specs-data-model.md](../../issues/486-enhance-the-issues-specs-data-model.md)

## Overview

Documentation only. Rewrite `docs/agents/specs/issues/model.md` into the full data model of the Issues and Projects feature (four tables in one `issues` module, constraints and indexes, the pending marker, cleanup contracts, the fold list for `product.md`, alternatives and edge cases), resolve its open questions, and update the other spec files with short consequence bullets pointing at it. The decisions come from the issue body and are not to be reopened.

## Context

- Epic #483; #484 wrote the general specs and #485 (merged as #496) enhanced `projects.md`, which defers columns and types, the MySQL enforcement of uniqueness among non-deleted projects and the user-deletion mechanism to #486.
- Only files under `docs/agents/specs/` are edited; the permanent docs (`product.md`, `modules/`, `AGENTS.md`, `CLAUDE.md`) are folded by #492. `CLAUDE.md` and `AGENTS.md` hold the user's own rules, so #492 asks before touching them.
- Conventions to mirror: Repositories' data model (`docs/agents/modules/repositories.md`): `int` ids, plain `int user_id`, logical FKs, `idx_<table>_<cols>` index names, timestamps from the injected `Clock`, the `integration.deleted` and `user.deleted` events.
- Open-question format: `## Open questions` with `- [ ]` items naming the owner issue; each spec file ends with a "Required tests" section that must match its rules.
- Responsible agent: `architect` (no specialist has work; every file is a spec under `docs/agents/`).

## Steps

- [01 — Rewrite model.md](plan/01-rewrite-model-md.md)
- [02 — Update projects.md, github-link.md and sync.md](plan/02-projects-github-link-sync.md)
- [03 — Update security.md, edge-cases.md, testing.md and api.md](plan/03-security-edge-cases-testing-api.md)
- [04 — Update the index](plan/04-update-the-index.md)
- [05 — Verify](plan/05-verify.md)

## Notes

- No CI job runs on documentation changes; verification is a manual consistency pass (step 05).
- Specs describe decisions, not code: name existing code only to point at a convention to follow.
- No real tokens, secrets, personal data or private repository names in any spec.
- "Project" means Kerghan's; write "GitHub Project" in full for GitHub's feature.
