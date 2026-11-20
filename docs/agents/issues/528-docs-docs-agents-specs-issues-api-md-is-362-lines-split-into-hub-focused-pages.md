# Docs: docs/agents/specs/issues/api.md is 362 lines — split into hub + focused pages

## Context

`docs/agents/specs/issues/api.md` is 362 lines long. Agents load this file whole whenever they need any part of it, so a question about one topic pulls the entire document into context. The file is above the repo's 300-line cap (AGENTS.md) and mixes several independent topics. Loading it costs far more context than most tasks need, and editing it raises the chance of merge conflicts.

## What needs to be done

Turn `docs/agents/specs/issues/api.md` into a hub and move its sections into focused pages under `docs/agents/specs/issues/api/`, following the same pattern used in #509, #510 and #511 (split client completion/update guides, slim hub).

### Hub (`docs/agents/specs/issues/api.md`)

- Keeps a short 1–2 paragraph summary of the subject. Keeps Every route, Exposed identifiers, Open questions and Required tests.
- Ends with an index linking every page under `docs/agents/specs/issues/api/`, each with a one-line description of when to read it.

### Proposed pages (`docs/agents/specs/issues/api/`)

- `projects.md` — Projects: object, listing, creation, edit, repository, delete, refusal data
- `issues.md` — Issues: object, listing, create and edit, delete
- `github-link.md` — GitHub link (order of checks, failures E57–E60, attach confirmation E61, unlink E63/E64) and how sync is exposed (link object, trigger routes)
- `errors-and-validation.md` — Error catalogue and input validation

The breakdown above follows the file's current sections; the plan may adjust page boundaries as long as the rules below hold.

### Rules

- Every resulting page, the hub included, stays under 300 lines.
- Pure reorganization: content moves, it is not rewritten, dropped or changed in meaning.
- Update every inbound link (AGENTS.md, `.claude/agents/*.md`, other docs) that points to a section that moved, so it targets the new page and anchor.
- Fix relative links inside the moved content so they still resolve from the new location.

## Acceptance criteria

- [ ] `docs/agents/specs/issues/api.md` is a hub that keeps a short summary, Every route, Exposed identifiers, Open questions and Required tests, and ends with an index of the pages under `docs/agents/specs/issues/api/`, each with a one-line "when to read it".
- [ ] The sections listed above are moved into focused pages under `docs/agents/specs/issues/api/`.
- [ ] Every resulting page, the hub included, is under 300 lines.
- [ ] No content is rewritten, dropped or changed in meaning.
- [ ] All inbound links (AGENTS.md, `.claude/agents/*.md`, other docs) target the new pages and anchors.
- [ ] Relative links inside the moved content resolve from the new location.
