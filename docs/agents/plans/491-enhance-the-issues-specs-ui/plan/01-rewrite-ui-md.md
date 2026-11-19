# Rewrite ui.md

Replace the current minimum list with a full spec built from the issue's Solution section. Header: "Decided. Part of the Issues and Projects specs." Suggested sections, in order:

1. **Screens and navigation**: the seven hash routes (literal segments before params), the project page as the issue list, separate edit routes, list state in the hash query, the header "Projects" link.
2. **Creation**: the explicit form (fields, search picker over added repositories via `POST /repositories/mine.json` with `filter: "added"`, prefill query, field-level errors) and the one-click shortcut on Added Repositories rows with the `PROJECT_NAME_TAKEN` fallback to the prefilled form.
3. **Project management**: Details, Repository (immediate Change/Detach, `PROJECT_HAS_LINKS` with `meta.linkCount`), Danger zone (typed-name delete, general warning, post-delete notice with `unsentIssueCount`).
4. **Lists**: project list (name, repository and status, open-issue count, "API in #507") and the project page (header, toolbar, rows, link column, bulk close/reopen, "API in #507").
5. **Issue page and forms**: actions, Close/Reopen, delete disabled while linked, Write/Preview through `IssueBody`, linked and gone notes.
6. **Linking flows**: shared input parsing (number, `#N`, GitHub URL, checked against the project's repository), modals, import, attach with the differences warning re-shown on a stale confirmation (E61), unlink with the discard confirmation (E63) and `ISSUE_NOT_LINKED` as done (E64).
7. **Link and sync states**: the state table (badge, message, actions), secondary states, last synced and stale, action rules derived from `states`, rate-limit time, project-header repository status hints, the client-side URL parsing note.
8. **Re-reading after a trigger**: the 2 s / 5 s / 10 s bounded re-read and its stop condition, after edits of linked issues, `alreadyFresh`, retry no-op, project refresh notice and single re-read, window focus throttled to 30 s.
9. **Empty, loading and error states**: loading texts, not found, the empty-state table, the error policy (API message plus targeted overrides), rate-limit countdown, client-side validation, `ApiError.meta`.
10. **Confirmations**: `ConfirmModal`, its uses, focus on Cancel, danger button naming, in-flight state.
11. **Edge cases**: U1 to U11.
12. **Security and performance**: S1 to S5, P1 to P5 (lazy-loaded `IssueBody`).
13. **Backward compatibility**: the touch-point table for #492.
14. **Scope**: in scope, brought in with #507, out of scope.
15. **Rejected alternatives**: the 16 items.
16. **Open questions**: "None left in this file", plus the #507 dependency for the count and bulk screens.
17. **Required tests** (frontend tier, three layers as in `testing.md`): routes and route order; creation, shortcut and fallback; project edit sections; typed-name delete and the post-delete notice (no count in the confirmation); lists, hash-query state and normalization (U6); page-past-end (U5); issue page actions and forms (Preview through `IssueBody`); input parsing and the repository mismatch; attach warning and its re-show on a stale confirmation (E61); unlink discard (E63) and `ISSUE_NOT_LINKED` as done (E64); every row of the state table and every action rule (E1, E2, E17 to E21); bounded re-reads and their stop conditions, with a fake clock; empty/loading/error states and each override of the error map; rate-limit countdown; `ConfirmModal` focus and naming; U1 to U11; S1 (static: no `dangerouslySetInnerHTML`, titles and descriptions as text) and S3 (uuid check and encoding) as static or unit checks; bulk close/reopen and counts marked "API in #507".

Keep the existing cross-links (`projects.md`, `github-link.md`, `api.md`, `security.md`, `sync.md`, `testing.md`).

## Files to Change

- `docs/agents/specs/issues/ui.md` — full rewrite as above.
