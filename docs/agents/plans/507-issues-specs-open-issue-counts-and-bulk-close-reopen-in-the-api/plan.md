# Plan: Issues specs: open-issue counts and bulk close/reopen in the API

Issue: [507-issues-specs-open-issue-counts-and-bulk-close-reopen-in-the-api.md](../../issues/507-issues-specs-open-issue-counts-and-bulk-close-reopen-in-the-api.md)

## Overview

Documentation only (`architect`). Amend the Issues and Projects specs under `docs/agents/specs/issues/` so they define `openIssueCount` on the project object and the 19th route, `POST /projects/:projectId/issues/bulk-state.json`, exactly as decided in the issue's Solution, then make every related spec file (rules, edge cases, testing, UI) consistent with it. No code, migrations or endpoints; #563 builds them.

## Context

- The issue's **Solution** section is the source for every decision: scope, the count (may lag; v1 computed at read time with one grouped query per listing page), the bulk shape (`{ state, changed, unchanged, notFound }`, always `200`), the transaction and lock order, the rate-limit weight (`issueIds.length`, all-or-nothing, a refused call consumes nothing), validation (1 to 100 unique uuids, duplicates `400`), edge cases E66 to E74, backward compatibility and the required tests. Copy decisions from there; do not re-decide.
- Specs describe decisions, not code ([specs.md](../../specs.md#conventions)); each file keeps its "Required tests" section next to the rules it verifies.
- Keep each spec file under about 300 lines, the size the recent split issues (#528 to #531) used; `security.md` (263 lines) and `model.md` (217) grow the most, so keep additions there tight and put the detail in `api/issues.md`.
- Edge-case rows in `edge-cases.md` are an index: one line of outcome each, linking to the owning rule.

## Steps

- [01 — API pages](plan/01-api-pages.md)
- [02 — Rule files (projects, model, security, sync)](plan/02-rule-files.md)
- [03 — Edge cases and testing](plan/03-edge-cases-and-testing.md)
- [04 — UI specs](plan/04-ui-specs.md)
- [05 — Consistency sweep](plan/05-consistency-sweep.md)

## Notes

- No CI job checks the docs; verification is the sweep of step 05.
- `../issues.md`'s implementation table already routes #563 to "`api.md` as amended by #507"; it stays as is.
- The single Edit gains one explicit rule here ("a refused `429` consumes nothing"); it is not built yet, so no other issue changes.
