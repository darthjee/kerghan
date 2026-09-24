# Drop obsolete PMD exclusions from .codacy.yml
With no `static async #method` syntax left in `ApiClient.js` / `AccountsClient.js`, the PMD
parser limitation from issue #30 no longer applies to them. In `.codacy.yml` under
`engines.pmd.exclude_paths`:

- Remove `'frontend/assets/js/client/ApiClient.js'` and
  `'frontend/assets/js/client/AccountsClient.js'`.
- Keep `'frontend/assets/js/components/common/header/controllers/HeaderController.js'` (still a
  class with private methods; tracked by #230).
- Trim the comment above the list so it describes only the remaining file (e.g. "the file below
  uses private methods extensively"; keep the PR #33 / issue #30 reference and the
  `HeaderController.js:27` finding).

## Files to Change
- `.codacy.yml` — remove the two PMD exclusion entries and update their comment.
