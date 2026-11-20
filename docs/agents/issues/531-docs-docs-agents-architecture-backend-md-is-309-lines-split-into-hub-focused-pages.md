# Docs: docs/agents/architecture/backend.md is 309 lines — split into hub + focused pages

## Context

`docs/agents/architecture/backend.md` is 309 lines long, above the repo's 300-line cap (AGENTS.md), and mixes several independent topics. Agents load this file whole whenever they need any part of it, so a question about one topic pulls the entire document into context, and editing it raises the chance of merge conflicts.

## What needs to be done

Turn `docs/agents/architecture/backend.md` into a hub and move its sections into focused pages under `docs/agents/architecture/backend/`, following the same pattern used in #509, #510 and #511 (split client completion/update guides, slim hub).

**Hub (`docs/agents/architecture/backend.md`)**
- Keeps a short 1–2 paragraph summary of the subject. Keeps Stack, Layout, Owned tables and Build.
- Ends with an index linking every page under `docs/agents/architecture/backend/`, each with a one-line description of when to read it.

**Proposed pages (`docs/agents/architecture/backend/`)**
- `request-pipeline.md` — Routing convention, data source, Origin Guard (CSRF), health probes, JWT Guard, Admin Guard
- `error-responses.md` — Error responses and dependency injection only
- `testing.md` — Testing, DB-backed tier, injected time source

The breakdown follows the file's current sections; the plan may adjust page boundaries as long as the rules below hold.

**Rules**
- Every resulting page, the hub included, stays under 300 lines.
- Pure reorganization: content moves, it is not rewritten, dropped or changed in meaning.
- Update every inbound link (AGENTS.md, `.claude/agents/*.md`, other docs) that points to a section that moved, so it targets the new page and anchor.
- Fix relative links inside the moved content so they still resolve from the new location.

## Acceptance criteria

- [ ] `docs/agents/architecture/backend.md` is a hub with a short summary, Stack, Layout, Owned tables and Build, plus an index of every page under `docs/agents/architecture/backend/` with a one-line "when to read" description.
- [ ] Focused pages exist under `docs/agents/architecture/backend/` (e.g. `request-pipeline.md`, `error-responses.md`, `testing.md`).
- [ ] Every resulting page, the hub included, is under 300 lines.
- [ ] Content is moved, not rewritten, dropped or changed in meaning.
- [ ] All inbound links (AGENTS.md, `.claude/agents/*.md`, other docs) target the new pages and anchors.
- [ ] Relative links inside the moved content still resolve from the new location.
