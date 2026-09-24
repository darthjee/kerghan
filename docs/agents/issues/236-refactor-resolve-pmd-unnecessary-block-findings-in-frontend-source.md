# Issue: Refactor: Resolve PMD Unnecessary block findings in frontend source

## Description
Codacy's PMD ecmascript parser flags "Unnecessary block" (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`, Info) on object literals and `try` blocks in `frontend/assets/js/` that are not redundant. This is the same parser limitation already documented in `.codacy.yml` for issue #30 (HeaderController.js).

## Problem
11 findings across 8 files under `frontend/assets/js/`:

- `components/common/forms/controllers/AccountEditFormController.js:80,122,151`
- `components/resources/accounts/pages/controllers/MyAccountController.js:53,81`
- `components/resources/accounts/pages/controllers/AuthorizationRequestsController.js:34`
- `components/resources/admin/pages/controllers/AdminUsersController.js:51`
- `utils/polling/AuthorizationRequestPoller.js:81`
- `utils/validation/fieldValidators.js:31,34`
- `utils/validation/formValidators.js:61`

Checking each line shows that **none of the blocks is actually redundant**:

- **Object literals** (8 findings): `return { ...a, ...b }` spreads, a computed key `{ [field]: ... }`, an empty `{}`, and plain `return { a: '', b: '' }` literals. PMD's older ecmascript grammar misreads these as statement blocks.
- **`try {` blocks** (3 findings: AuthorizationRequestsController:34, AdminUsersController:51, AuthorizationRequestPoller:81). These are real `try/catch` blocks inside `async` functions.

These constructs appear throughout the frontend, so per-file `.codacy.yml` exclusions would keep growing with every new file. Each exclusion would also hide *all* PMD findings in that file, not only this rule.

## Expected Behavior
The PMD `UnnecessaryBlock` pattern no longer produces findings anywhere in the repo, and every other PMD rule keeps analysing these files.

## Solution
- Disable the `PMD_category_ecmascript_codestyle_UnnecessaryBlock` pattern in the Codacy dashboard (Code patterns → PMD). This is a manual step for the repo owner: `.codacy.yml` cannot disable a single pattern.
- Do not add any `engines.pmd.exclude_paths` entries for these files.
- Leave the existing HeaderController.js exclusion in `.codacy.yml` untouched.
- No changes under `frontend/assets/js/`.

## Benefits
Removes all 11 Info findings, and future ones, without widening PMD blind spots file by file.

## Verification

- After the pattern is disabled, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.
