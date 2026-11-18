# Update model.md, projects.md and api.md

**model.md**

- Cleanup "Project deletion (soft)": one transaction in lock order: lock the project row, count issues with markers, delete markers, links and issues, clear `description`, set `deleted_at` and `deleted_token`. Remove "The `issues` rows stay, unreachable, with no purge in v1".
- Edge row 7: the old project's issue rows were deleted with the project.
- Performance and security: content stored unencrypted, decided in `security.md`.
- Duplicate keys: every unique index's `ER_DUP_ENTRY` is mapped at the write, never re-thrown (link to `security.md`).
- Fold list: the `architecture/security.md` row also covers "Fixed operations: `GET`-only".
- Open questions: close retention and "encryption … and per-user quotas" (#490).
- Required tests: deletion removes issues, links and markers and keeps the tombstone.

**projects.md**

- Deletion: "Its issues are kept in the database but are unreachable" becomes "Its issues, links and markers are deleted; the project row stays as a tombstone with its description cleared". Add the live-project cap (`409 PROJECTS_LIMIT_REACHED`, tombstones not counted, the shortcut's `200` never refused).
- Required tests follow.

**api.md**

- Error catalogue: add `409 PROJECTS_LIMIT_REACHED`, `409 ISSUES_LIMIT_REACHED`, `429 ISSUE_LINK_RATE_LIMITED`, `429 ISSUE_EDIT_RATE_LIMITED` (with `Retry-After` and `retryAfterSeconds`); update the new-code count.
- Order of checks: the link rate limit and the edit rate limit after DTO validation and before the access check; the caps inside the creation lock, and import's pre-check before the GitHub call.
- Delete response text: `unsentIssueCount` is counted before the issues are deleted.
- The two "#490's" rendering mentions point to `security.md`; close the "(#490)" open question.
- Required tests: the four new codes.

## Files to Change

- `docs/agents/specs/issues/model.md` — deletion, duplicate keys, fold list, open questions.
- `docs/agents/specs/issues/projects.md` — deletion and project cap.
- `docs/agents/specs/issues/api.md` — four codes, order of checks, open question.
