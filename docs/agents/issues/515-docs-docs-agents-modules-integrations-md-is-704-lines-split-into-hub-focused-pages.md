# Issue: Docs: docs/agents/modules/integrations.md is 704 lines — split into hub + focused pages

## Description
`docs/agents/modules/integrations.md` is 704 lines long. Agents load this file whole whenever they need any part of it, so a question about one topic pulls the entire document into context.

## Problem
The file is above the repo's 300-line cap (AGENTS.md) and mixes several independent topics. Loading it costs far more context than most tasks need, and editing it raises the chance of merge conflicts.

## Solution
Turn `docs/agents/modules/integrations.md` into a hub and move its sections into focused pages under `docs/agents/modules/integrations/`, following the same pattern used in #509, #510 and #511 (split client completion/update guides, slim hub).

### Hub (`docs/agents/modules/integrations.md`)
- Keeps a short 1–2 paragraph summary of the subject. Keeps Overview and the Types list.
- Ends with an index linking every page under `docs/agents/modules/integrations/`, each with a one-line description of when to read it.
- The existing type docs (`github-app.md`, `github-service.md`, `oauth-app.md`, `pat.md`) already in that folder stay listed in the hub (the current Types section).

### Proposed pages (`docs/agents/modules/integrations/`)
- `data-model.md` — Storage model, tables, `integrations` columns, owner foreign key, constraints, status lifecycle, edge cases, lockout table, migrations
- `security.md` — Access rules, encryption at rest, secrets never logged, rate limiting, credential failure cool-off, test-connection cooldown, faking GitHub in tests
- `type-contract.md` — Strategy interface, flow kind, redirect flow invariants, validate/create, test connection, describe metadata, masking, delete behaviour, status reason codes, registration, what a type doc must contain
- `frontend.md` — Menu item, page, list columns, actions, type picker, credential input rules

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

