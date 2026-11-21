# Consistency sweep

Check the amended specs as a whole before committing.

- `grep -rn "#507\|API in #507\|18 routes\|no issue counts\|E1…E65" docs/agents/specs/` shows no stale placeholder (only historical "decided in #507" mentions, if any).
- Every route list and matrix reads 19 routes with the same path spelling (`/projects/:projectId/issues/bulk-state.json`).
- The response field names (`openIssueCount`, `issueIds`, `state`, `changed`, `unchanged`, `notFound`) and the codes (`VALIDATION_FAILED`, `ISSUE_EDIT_RATE_LIMITED`, `NOT_FOUND`) match across `api/*`, `security.md`, `edge-cases.md`, `testing.md` and `ui/*`.
- Relative links added in steps 01 to 04 resolve (anchors included).
- `wc -l` on every touched file: each stays under about 300 lines; if one would not, move detail into the matching `api/` page instead of growing it.
- No file outside `docs/agents/specs/` changes, and no code.

## Files to Change

- None beyond fixes found by the sweep in the files of steps 01 to 04.
