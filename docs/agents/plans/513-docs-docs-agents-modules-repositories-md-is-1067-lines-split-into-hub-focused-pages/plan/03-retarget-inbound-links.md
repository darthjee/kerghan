# Retarget inbound links
Every link to `repositories.md#<anchor>` for a moved anchor must point to the new page: `repositories/<page>.md#<anchor>` (adjusting the relative prefix). Links to `repositories.md` with no anchor, and to hub-owned anchors (`#overview`, `#not-built`, `#module-boundaries-and-ownership`), stay. Find them with `grep -rnE 'repositories\.md#' AGENTS.md CLAUDE.md .claude docs` (excluding `docs/agents/issues`, `docs/agents/plans` and `backend/routes/repositories.md`, which is another file).

Known inbound files: `docs/agents/modules/repositories/{sync,edge-cases}.md` (they use `../repositories.md#…`: a lot of anchors, e.g. `#row-statuses`, `#user-deletion`, `#testing`, `#ui-edge-cases`, `#model-tests`, `#detached-sync-and-time`, `#fixed-github-base-url`), `docs/agents/modules/auth/github-handle.md`, `docs/agents/modules/auth.md`, `docs/agents/modules/integrations/github-service.md`, `docs/agents/modules/integrations.md`, `docs/agents/backend/routes/repositories.md` (`#csrf`, `#row-statuses`, `#repositories_sources`, `#table`, `#source-errors`), `docs/agents/architecture/security.md`, `docs/agents/specs/issues/{testing,security,model,projects}.md`, `docs/agents/specs.md` (the Repositories row: list the new pages), `docs/agents/summary.md`, `docs/agents/index.md` and `docs/agents/folder-structure.md` (no anchor: confirm they still read correctly). `AGENTS.md` and `.claude/agents/*.md` have no links to this file today (re-check).

A scripted mapping (anchor → page) is recommended over hand edits: generate it from the headings of the new pages, then apply with `sed`, and review the diff.

## Files to Change
- All files listed above — anchors retargeted; `docs/agents/specs.md` additionally lists the new pages.
