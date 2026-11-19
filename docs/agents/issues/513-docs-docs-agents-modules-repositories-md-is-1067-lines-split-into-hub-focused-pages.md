# Issue: Docs: docs/agents/modules/repositories.md is 1067 lines — split into hub + focused pages

## Description
`docs/agents/modules/repositories.md` is 1067 lines long. Agents load this file whole whenever they need any part of it, so a question about one topic pulls the entire document into context.

## Problem
The file is above the repo's 300-line cap (AGENTS.md) and mixes several independent topics. Loading it costs far more context than most tasks need, and editing it raises the chance of merge conflicts.

## Solution
Turn `docs/agents/modules/repositories.md` into a hub and move its sections into focused pages under `docs/agents/modules/repositories/`, following the same pattern used in #509, #510 and #511 (split client completion/update guides, slim hub).

### Hub (`docs/agents/modules/repositories.md`)
- Keeps a short 1–2 paragraph summary of the subject. Keeps Overview, Not built and Module boundaries and ownership.
- Ends with an index linking every page under `docs/agents/modules/repositories/`, each with a one-line description of when to read it.
- The existing `edge-cases.md` and `sync.md` already in that folder are listed in the hub index too.

### Proposed pages (`docs/agents/modules/repositories/`)
- `data-model.md` — Data model: tables, row statuses, logical foreign keys, private metadata lifecycle, ownership
- `security.md` — Security: module boundaries, user scoping, add verification, private metadata and retention, GitHub handle, fixed base URL, CSRF, errors and logging, abuse and performance
- `frontend.md` — Frontend: placement, table, toolbar, sync UX, source errors, empty state, GitHub handle field, UI edge cases
- `testing.md` — Testing strategy: tiers, default tier by category, GitHub mocking, detached sync and time
- `testing-coverage.md` — Testing coverage: concurrency and races, access control and leaks, module-boundary, frontend and cache tests, where tests live
- `required-tests.md` — Required tests: model, security and UI tests

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

