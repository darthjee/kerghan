# Draft the sub-issue bodies

Write one Markdown body per row of the split table in the issue file, in the scratchpad (for example `<scratchpad>/492/NN-<slug>.md`), never in the repo. Use the same shape and tone as the spec issues of the epic (#485 to #494): plain English, short sentences.

Each body has:

- **Description**: one paragraph. "This is part of the epic #483 (Issues and Projects)", what the issue builds, and that the specs are the source of truth: the issue makes no product decision of its own, and a change of decision updates the spec in the same PR (`docs/agents/specs.md`, lifecycle step 2).
- **Builds against**: the spec files of the row, as repository paths with section anchors where the row names a section (for example `docs/agents/specs/issues/sync.md#github-issue-client-operations`). Always add `docs/agents/specs/issues.md` (the index) and the rows of `edge-cases.md` that apply to the area. Use the E numbers listed in `testing.md#coverage-per-area`.
- **Task**: what to build, taken from the row's scope and the named spec sections. Keep it to the list of parts, not a copy of the specs.
- **Depends on**: the rows it waits for, written as "row N (<title>)" placeholders. Step 02 replaces them with real issue numbers. Row 6 also says "#479 (background workers), closed: satisfied". Row 11 and row 12 also name #507.
- **Acceptance criteria**: the Required tests of every spec file it builds against are implemented on the tier given by `testing.md#default-tier-by-category`. The `docs/agents/environment-variables.md` and `docs/agents/modules/workers.md` updates go in the same change that reads the new keys (rows 1 and 6, as `sync.md#configuration` requires). No decision differs from the specs, or the spec is updated in the same PR.
- **Notes**: "Responsible agent: `<agent>`", plus the reviewers. Row 7 names `security`, `data-access` and `cache`. Every row with routes (3 to 7, 11) asks for the `cache` agent's cache-class review and the `security` and `data-access` checklists of `security.md#review-checklist`.

Row-specific points to carry into the bodies:

- **Row 1 (foundation)**: the migrations named `<timestamp>-issues-<action>.ts`, created in the order of `model.md` and dropped in reverse. The config keys of `sync.md#configuration` (all nine, so the later rows only read them). The `user.deleted` listener. The lock order. The single access check that rows 3 to 6 use. The seed builders and the intruder user of `testing.md#fixtures`. Also the static specs of `testing.md#security-verification` that apply to the module skeleton (no `fetch`, no `NOW(`, the column allowlist).
- **Row 2 (GitHub issue client)**: the `issues: write` permission of the GitHub App, with per-operation tokens and the token cache keyed by installation and permission set (`security.md#the-github-app-gains-issues-write`). The `FakeIntegrationsGithubService` extension, the fidelity contract spec and the redirect and `Location` contract spec (`testing.md#fixtures`).
- **Row 6 (sync workers)**: the refresh (T2, T3) and retry-sync (T4) routes are built here, not in row 5.
- **Row 7 (security verification)**: the complete route access matrix over the 18 routes, with its completeness check. The credential and content canary sweeps. The cache-policy coverage spec. The review checklists of `security.md#review-checklist`.
- **Row 8 (frontend 1)**: the API client layer and `ConfirmModal` are shared by rows 9 and 10.
- **Row 9 (frontend 2)**: `IssueBody` with the restricted Markdown of `security.md#bodies-restricted-markdown`, lazy-loaded with the `<pre>` fallback (P5).
- **Row 11 (counts and bulk)**: built only once #507 has amended `api.md`. The backend part (the count query and the bulk route) and the frontend part (`ui/states.md#scope`). Add the new route to the access matrix of row 7.
- **Row 12 (fold)**: the full fold list of `model.md#persistence-statement-and-fold-list`. Update the product-owner map row in `.claude/agents/product-owner.md`. Propose the `AGENTS.md` and `CLAUDE.md` edits and ask before touching them. Copy the repository-removal rule into `docs/agents/modules/repositories.md`. Delete `docs/agents/specs/issues.md` and `docs/agents/specs/issues/`. Move the entry in `docs/agents/specs.md` from *Active specs* to *Completed specs*. It waits for every other row and #507.

Titles: short and specific, prefixed the same way for the whole set, for example `Issues: foundation (module, tables, config, cleanup)`, `Issues: GitHub issue client in Integrations`, ..., `Issues: fold the specs into the permanent docs`.

## Files to Change

- Scratchpad only (`<scratchpad>/492/*.md`): one body per row. Nothing in the repo.
