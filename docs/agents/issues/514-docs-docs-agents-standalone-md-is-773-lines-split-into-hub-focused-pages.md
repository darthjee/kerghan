# Issue: Docs: docs/agents/standalone.md is 773 lines — split into hub + focused pages

## Description
`docs/agents/standalone.md` is 773 lines long. Agents load this file whole whenever they need any part of it, so a question about one topic pulls the entire document into context.

## Problem
The file is above the repo's 300-line cap (AGENTS.md) and mixes several independent topics. Loading it costs far more context than most tasks need, and editing it raises the chance of merge conflicts.

## Solution
Turn `docs/agents/standalone.md` into a hub and move its sections into focused pages under `docs/agents/standalone/`, following the same pattern used in #509, #510 and #511 (split client completion/update guides, slim hub).

### Hub (`docs/agents/standalone.md`)
- Keeps a short 1–2 paragraph summary of the subject. Keeps Overview, Why Vault and Out of scope.
- Ends with an index linking every page under `docs/agents/standalone/`, each with a one-line description of when to read it.
- The existing `client-completion.md`, `client-config.md` and `client-update.md` already in that folder are listed in the hub index too.

### Proposed pages (`docs/agents/standalone/`)
- `install.md` — Requirements, installing the client, verifying release assets, upgrading
- `client.md` — The `kerghan` client: mapping to `vault`, secrets, `FRONTEND_BASE_URL`, `up` behavior, other behavior
- `config-files.md` — Configuration (`~/.kerghan/`) and the `config` format
- `inner-stack.md` — Inner stack: MySQL 9.3→8.4.11 migration, Tent and the frontend, `/vault/.env` and multi-arch Tent, Dockerfile targets, online/offline variants, same origin and `OriginGuard`, effective client IP and its verification
- `release-and-caveats.md` — Images and versioning, caveats, testing

The breakdown above follows the file's current sections; the plan may adjust page boundaries as long as the rules below hold.

### Rules
- Every resulting page, the hub included, stays under 300 lines.
- Pure reorganization: content moves, it is not rewritten, dropped or changed in meaning.
- Update every inbound link (AGENTS.md, `.claude/agents/*.md`, other docs) that points to a section that moved, so it targets the new page and anchor.
- Fix relative links inside the moved content so they still resolve from the new location.

## Benefits
- Agents load only the page relevant to their task, which cuts context usage.
- Each page complies with the 300-line cap from AGENTS.md.
- Smaller files mean easier navigation and fewer merge conflicts.

