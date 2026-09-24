# Issue: Refactor: Resolve PMD Unnecessary block findings in spec support files

## Description
Codacy's PMD ecmascript parser flags "Unnecessary block" (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`, Info) in the shared spec helpers under `frontend/specs/support/`. This is the same parser limitation handled for frontend source in #236.

## Problem
4 findings (line numbers are from filing time and have drifted since):

- `frontend/specs/support/accountEditFormControllerExamples.js:231`
- `frontend/specs/support/accountEditFormHelperExamples.js:152`, `:161`
- `frontend/specs/support/fetchSequence.js:16`

None of the flagged constructs is actually redundant. They are object literals (for example `return { ...rest, text, json }` in `fakeResponse`), destructuring (`const { Helper } = options`), and JSDoc type braces. PMD's older ecmascript grammar misreads these as statement blocks.

## Expected Behavior
The PMD `UnnecessaryBlock` pattern no longer produces findings in `frontend/specs/support/`, and every other PMD rule keeps analysing these files.

## Solution
- #236 already covers this. Its resolution disables the `PMD_category_ecmascript_codestyle_UnnecessaryBlock` pattern repo-wide in the Codacy dashboard (Code patterns → PMD), which also clears these 4 findings.
- Do not add any `engines.pmd.exclude_paths` entries for these files.
- No changes to `.codacy.yml` or `frontend/specs/support/`.
- The only work left is to confirm the pattern is disabled and that Codacy no longer reports these findings.

## Benefits
Removes the 4 Info findings without widening PMD blind spots file by file, and avoids conflicts with #216 and the spec-support dynamic-key issue, which edit the same files.

## Verification

- After the pattern is disabled, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.
