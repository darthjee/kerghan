# Plan: Docs: docs/agents/modules/repositories/sync.md is 527 lines — split into hub + focused pages

Issue: [518-docs-docs-agents-modules-repositories-sync-md-is-527-lines-split-into-hub-focused-pages.md](../../issues/518-docs-docs-agents-modules-repositories-sync-md-is-527-lines-split-into-hub-focused-pages.md)

## Overview
Docs-only reorganization, done by the architect (no specialist agent owns `docs/`). `docs/agents/modules/repositories/sync.md` becomes a hub and its sections move, unchanged, into four pages under `docs/agents/modules/repositories/sync/`. Same pattern as #509–#516.

## Context
`sync.md` is 527 lines (cap: 300). Current sections and line ranges:

| Lines | Section | Destination |
|---|---|---|
| 1–66 | Intro, Sources, Handle credential | stays in hub |
| 67–167 | Trigger, Execution, Per-user lock, Time source, Restart recovery | `sync/execution.md` |
| 168–312 | Per source (Write path, Link fill), Partial failures, Pruning | `sync/write-path.md` |
| 313–407 | Rate limits, Conditional requests, Network, Values, Edge cases | `sync/github-limits.md` |
| 408–527 | Required tests | `sync/required-tests.md` |

## Implementation Steps

### Step 1 — Split the file
- Create `sync/execution.md`, `sync/write-path.md`, `sync/github-limits.md`, `sync/required-tests.md`, each with an `# H1` title and the moved sections verbatim (headings demoted/kept so anchors stay identical; do not rewrite text).
- Fix relative links inside moved content (now one directory deeper: `../` → `../../`, and links to sibling repositories pages such as `data-model.md` → `../data-model.md`). Links between the sync pages and to anchors still in the hub (`Sources`, `Handle credential`) must resolve.
- Trim `sync.md` to intro + Sources + Handle credential, then add an index linking all four pages with a one-line "read when" description each.
- Verify every resulting file is under 300 lines (`wc -l`).

### Step 2 — Update inbound links
Retarget every link/anchor pointing at a moved section, using the mapping:
- `#trigger`, `#execution`, `#per-user-lock`, `#time-source`, `#restart-recovery` → `sync/execution.md`
- `#per-source`, `#write-path`, `#link-fill`, `#partial-failures`, `#pruning` → `sync/write-path.md`
- `#rate-limits`, `#conditional-requests`, `#network`, `#values`, `#edge-cases` → `sync/github-limits.md`
- `#required-tests` → `sync/required-tests.md`
- `#sources`, `#handle-credential`, bare `sync.md` → unchanged (hub)

Affected files (found via `grep`): `docs/agents/modules/repositories/{edge-cases,data-model,security,required-tests,testing}.md`, `docs/agents/modules/repositories.md`, `docs/agents/modules/integrations/github-service.md`, `docs/agents/modules/auth/github-handle.md`, `docs/agents/backend/routes/repositories.md`, `docs/agents/future.md`, `docs/agents/summary.md`, `docs/agents/specs.md`, `AGENTS.md` and `.claude/agents/*.md` if they reference it.

Also check for links in the opposite direction: other docs that reference `sync.md` by relative path with moved anchors, and anchors from the moved pages back to other files.

## Files to Change
- `docs/agents/modules/repositories/sync.md` — slim to hub + index
- `docs/agents/modules/repositories/sync/{execution,write-path,github-limits,required-tests}.md` — new
- Inbound-link files listed in Step 2

## Notes
- **Do not touch** `docs/agents/specs/issues/sync.md` and the `sync.md` / `sync.md#reconcile`, `#retries-and-sync`, `#marker-lifecycle`, `#staleness`, `#fields-and-ownership`, `#integration-selection`, `#triggers`, `#github-issue-client-operations` links in `docs/agents/specs/issues/*.md` and `specs/issues.md`: they point at the *issues* sync doc, a different file with the same name. Only `#required-tests`/`#rate-limits` need care — confirm by resolved path that the link targets `modules/repositories/sync.md` before changing anything.
- Verify afterwards with a link check: every `](...sync...)` target and anchor resolves; `grep -rn 'repositories/sync.md#'` shows only hub anchors (`sources`, `handle-credential`).
- No CI check applies (markdown only); no code changes.
