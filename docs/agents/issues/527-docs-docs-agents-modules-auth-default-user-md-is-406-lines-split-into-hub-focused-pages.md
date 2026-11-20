# Issue: Docs: docs/agents/modules/auth/default-user.md is 406 lines — split into hub + focused pages

## Description
`docs/agents/modules/auth/default-user.md` is 406 lines long. Agents load this file whole whenever they need any part of it, so a question about one topic pulls the entire document into context.

## Problem
The file is above the repo's 300-line cap (AGENTS.md) and mixes several independent topics. Loading it costs far more context than most tasks need, and editing it raises the chance of merge conflicts.

## Solution
Turn `docs/agents/modules/auth/default-user.md` into a hub and move its sections into focused pages under `docs/agents/modules/auth/default-user/`, following the same pattern used in #509, #510 and #511 (split client completion/update guides, slim hub).

### Hub (`docs/agents/modules/auth/default-user.md`)
- Keeps a short 1–2 paragraph summary of the subject. Keeps Overview, Out of scope and Testing.
- Ends with an index linking every page under `docs/agents/modules/auth/default-user/`, each with a one-line description of when to read it.

### Proposed pages (`docs/agents/modules/auth/default-user/`)
- `configuration.md` — Configuration and boot sync (password, collisions and races, disabled)
- `edit-blocking.md` — Edit blocking: what is blocked, why `409`, identifying the default user, per-field rule, order of checks, password recovery, edge cases, compatibility, future write paths
- `automatic-login.md` — Automatic login: boot warning, turning it off, why only `status.json`
- `security.md` — IP allowlist, production guard, admin access, credentials, standalone exposure, sessions after turning it off

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

