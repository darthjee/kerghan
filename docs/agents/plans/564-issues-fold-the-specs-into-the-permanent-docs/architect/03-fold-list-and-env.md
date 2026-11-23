# Rewrite the fold-list statements and environment variables

Rewrite the statements in the fold list of `model.md#persistence-statement-and-fold-list`, except `AGENTS.md` and `CLAUDE.md` (step 05) and `product-owner.md` (step 04). The rule is the persistence statement:

- Fetched GitHub issue data stays "not persisted by default" and read by the browser.
- Kerghan persists its own projects, issues, links and markers and, for a linked issue only, a snapshot of its GitHub data.
- The backend reads and writes GitHub for linked issues with the owner's credential, inside the Integrations module, as a narrow exception.
- "Opt-in issue persistence" (fetched issues for history and trends) stays deferred and distinct.

Changes, file by file:

- **`docs/agents/product.md`.** Rewrite "What the backend persists" (around line 21), "Issue fetching model" and "GitHub access". Add an *Issues and Projects* section, like the *Repositories* section, that links to `modules/issues.md`. Under *Deferred* (around line 125), keep "Opt-in issue persistence" and say it is distinct from Kerghan's own issues. Narrow the "using integration credentials for issues" item to what is still deferred: fetched issues stay unauthenticated, and linked issues already use the credential.
- **`docs/agents/architecture/security.md`.** In *GitHub credentials stay in the backend* (around line 127), state the linked-issue exception. Replace "**Fixed operations:** `GET`-only, except …" (around line 158) with the narrowed rule from `specs/issues/security.md#the-integrations-boundary`. Repoint its existing `specs/issues` links to `modules/issues/security.md`.
- **`docs/agents/summary.md`.** Update lines 12 and 54 to 57: issue data is no longer "never persisted", Kerghan's own issues are persisted, the product-definitions blurb changes, and a *Modules* entry links `modules/issues.md` if the summary lists modules.
- **`docs/agents/flow.md`.** Update lines 13 to 16 (the browser reads fetched issues, but not linked issues) and *Opt-in issue persistence* (around line 62). Add a step or short section for projects and linked issues, linking `modules/issues.md`.
- **`docs/agents/environment-variables.md`.** Add the nine `KERGHAN_ISSUES_*` variables, in the style of the `KERGHAN_REPOSITORIES_*` entries, taking name, default, range and meaning from `sync.md#configuration`, `security.md#quotas-and-abuse-limits` and the edit and link rate-limit sections:
  - `MAX_PROJECTS_PER_USER`, `MAX_ISSUES_PER_PROJECT`
  - `EDIT_MAX_PER_WINDOW`, `EDIT_WINDOW_MS`, `LINK_MAX_PER_WINDOW`, `LINK_WINDOW_MS`
  - `SYNC_COOLDOWN_MS`, `SYNC_MAX_RETRIES`, `SYNC_STALE_AFTER_SECONDS`

  Check each default against `backend/src/issues/issues-config.ts`, and raise any mismatch instead of guessing.

## Files to Change

- `docs/agents/product.md`: the persistence, fetching and GitHub-access statements, a new Issues and Projects section, and the Deferred items.
- `docs/agents/architecture/security.md`: the linked-issue exception, the narrowed fixed-operations rule, and repointed links.
- `docs/agents/summary.md`: the persistence wording and the product blurb.
- `docs/agents/flow.md`: the browser-only and opt-in wording, and the projects and issues flow.
- `docs/agents/environment-variables.md`: the nine `KERGHAN_ISSUES_*` variables.
