# Plan: Refactor: Resolve PMD Unnecessary block findings in frontend source

Issue: [236-refactor-resolve-pmd-unnecessary-block-findings-in-frontend-source.md](../../issues/236-refactor-resolve-pmd-unnecessary-block-findings-in-frontend-source.md)

## Overview
Disable the Codacy PMD pattern `PMD_category_ecmascript_codestyle_UnnecessaryBlock` in the Codacy dashboard. This clears all 11 false-positive findings, and any future ones, without changing the repository.

## Context
All 11 flagged lines were checked and none of the blocks is redundant. Eight are object literals (spreads such as `return { ...a, ...b }`, a computed key `{ [field]: ... }`, an empty `{}`, and plain `return { a: '' }` literals). Three are real `try/catch` blocks inside `async` functions. PMD's older ecmascript grammar misreads these as statement blocks.

We considered per-file `engines.pmd.exclude_paths` entries and rejected them. Every new frontend file using these constructs would need its own entry, and each entry hides *all* PMD rules for that file. `.codacy.yml` cannot disable a single pattern, so the pattern is turned off in the Codacy UI instead.

## Implementation Steps

### Step 1 — Disable the pattern in Codacy (manual, repo owner)
In the Codacy dashboard for `darthjee/kerghan`, go to Code patterns → PMD and disable `PMD_category_ecmascript_codestyle_UnnecessaryBlock` ("Unnecessary block"). An agent cannot do this step. It needs the repo owner's Codacy access.

### Step 2 — Verify
Trigger a re-analysis of `main`, or wait for the next one. Confirm that none of the 11 findings listed in the issue's **Problem** section is still reported, and that other PMD patterns are still active for those files.

## Files to Change
- None. No repository files change: `.codacy.yml` and `frontend/assets/js/` are left untouched, including the existing HeaderController.js PMD exclusion.

## Notes
- The issue has no code deliverable, so `auto-fix-issue` has nothing to implement. Close the issue manually once Step 2 is verified.
- The existing HeaderController.js exclusion (issue #30) becomes redundant once the pattern is disabled, but it is intentionally kept as-is. Removing it could be a follow-up.
