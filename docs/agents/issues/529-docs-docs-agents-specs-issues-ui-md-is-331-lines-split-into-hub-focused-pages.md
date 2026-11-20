# Docs: docs/agents/specs/issues/ui.md is 331 lines — split into hub + focused pages

## Context

`docs/agents/specs/issues/ui.md` is 331 lines long, above the repo's 300-line cap (AGENTS.md), and mixes several independent topics. Agents load the file whole whenever they need any part of it, so a question about one topic pulls the entire document into context, and editing it raises the chance of merge conflicts.

## What needs to be done

Turn `docs/agents/specs/issues/ui.md` into a hub and move its sections into focused pages under `docs/agents/specs/issues/ui/`, following the same pattern used in #509, #510 and #511 (split client completion/update guides, slim hub).

### Hub (`docs/agents/specs/issues/ui.md`)

- Keeps a short 1–2 paragraph summary of the subject. Keeps the intro, Open questions and Required tests.
- Ends with an index linking every page under `docs/agents/specs/issues/ui/`, each with a one-line description of when to read it.

### Proposed pages (`docs/agents/specs/issues/ui/`)

- `screens-and-flows.md` — Screens and navigation, creation flows, project management, lists, issue page and forms
- `linking-and-sync.md` — Linking flows, link and sync states, re-reading after a trigger
- `states.md` — Empty/loading/error states, confirmations, scope, UI edge cases
- `decisions.md` — Rejected alternatives, backward compatibility, performance and security

The breakdown above follows the file's current sections; the plan may adjust page boundaries as long as the rules below hold.

### Rules

- Every resulting page, the hub included, stays under 300 lines.
- Pure reorganization: content moves, it is not rewritten, dropped or changed in meaning.
- Update every inbound link (AGENTS.md, `.claude/agents/*.md`, other docs) that points to a section that moved, so it targets the new page and anchor.
- Fix relative links inside the moved content so they still resolve from the new location.

## Acceptance criteria

- [ ] `docs/agents/specs/issues/ui.md` is a hub with a short summary, intro, Open questions, Required tests and an index of the new pages.
- [ ] The moved sections live in focused pages under `docs/agents/specs/issues/ui/`.
- [ ] Every resulting page, the hub included, is under 300 lines.
- [ ] No content is rewritten, dropped or changed in meaning.
- [ ] All inbound links (AGENTS.md, `.claude/agents/*.md`, other docs) target the new page and anchor.
- [ ] Relative links inside the moved content resolve from the new location.
