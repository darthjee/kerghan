# Issue: Docs: docs/agents/environment-variables.md is 428 lines — split into hub + focused pages

## Description
`docs/agents/environment-variables.md` is 428 lines long. Agents load this file whole whenever they need any part of it, so a question about one topic pulls the entire document into context.

## Problem
The file is above the repo's 300-line cap (AGENTS.md) and mixes several independent topics. Loading it costs far more context than most tasks need, and editing it raises the chance of merge conflicts.

## Solution
Turn `docs/agents/environment-variables.md` into a hub and move its sections into focused pages under `docs/agents/environment-variables/`, following the same pattern used in #509, #510 and #511 (split client completion/update guides, slim hub).

### Hub (`docs/agents/environment-variables.md`)
- Keeps a short 1–2 paragraph summary of the subject. Keeps the intro and Keeping this doc honest.
- Ends with an index linking every page under `docs/agents/environment-variables/`, each with a one-line description of when to read it.

### Proposed pages (`docs/agents/environment-variables/`)
- `backend.md` — Backend application runtime variables
- `backend-setup.md` — Default user values and boot validation, setting `KERGHAN_INTEGRATIONS_KEY`, setting up the GitHub OAuth App and the GitHub App
- `key-rotation.md` — Rotating `KERGHAN_SECRET_KEY` and `KERGHAN_INTEGRATIONS_KEY`
- `proxy-navi-circleci.md` — Proxy (production), cache warmer (Navi), CircleCI project variables
- `standalone.md` — Standalone: how values flow, contract, `FRONTEND_BASE_URL`

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

