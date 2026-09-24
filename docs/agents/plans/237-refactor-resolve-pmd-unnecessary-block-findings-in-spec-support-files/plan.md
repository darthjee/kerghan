# Plan: Refactor: Resolve PMD Unnecessary block findings in spec support files

Issue: [237-refactor-resolve-pmd-unnecessary-block-findings-in-spec-support-files.md](../../issues/237-refactor-resolve-pmd-unnecessary-block-findings-in-spec-support-files.md)

## Overview
This needs no code or configuration change. The 4 PMD `UnnecessaryBlock` findings in
`frontend/specs/support/` are the same parser false positive handled in #236. #236 resolves it by
disabling the `PMD_category_ecmascript_codestyle_UnnecessaryBlock` pattern repo-wide in the
Codacy dashboard. The remaining work is to check that this also clears these findings.

## Context
The flagged constructs are not redundant blocks: `fakeResponse` in `fetchSequence.js` returns an
object literal with a spread, `accountEditFormHelperExamples.js` destructures
`const { Helper } = options`, and the other lines are JSDoc type braces. PMD's older ecmascript
grammar misreads these as statement blocks. Per-file `engines.pmd.exclude_paths` entries would
hide every PMD rule for these files, so the issue rules them out.

## Implementation Steps

### Step 1 — Confirm the pattern is disabled
The repo owner does this by hand. In the Codacy dashboard (Code patterns → PMD), confirm that
`PMD_category_ecmascript_codestyle_UnnecessaryBlock` is disabled, as #236 requires. If it is still
enabled, disable it there. `.codacy.yml` cannot disable a single pattern.

### Step 2 — Verify the findings are gone
After Codacy re-analyses `main`, confirm that no `UnnecessaryBlock` findings remain for
`frontend/specs/support/accountEditFormControllerExamples.js`,
`frontend/specs/support/accountEditFormHelperExamples.js` or
`frontend/specs/support/fetchSequence.js`.

## Files to Change
- None. Do not edit `.codacy.yml` or anything under `frontend/specs/support/`.

## Notes
- No specialist agent has work here. An auto-fix run should end up with an empty diff (plus the
  issue and plan docs), not invent code changes.
- #216 and the spec-support dynamic-key issue edit the same spec files. Since this issue touches
  none of them, there is no rebase risk.
