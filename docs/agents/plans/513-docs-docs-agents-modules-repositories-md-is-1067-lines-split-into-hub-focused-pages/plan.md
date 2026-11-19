# Plan: Docs: docs/agents/modules/repositories.md is 1067 lines — split into hub + focused pages

Issue: [513-docs-docs-agents-modules-repositories-md-is-1067-lines-split-into-hub-focused-pages.md](../../issues/513-docs-docs-agents-modules-repositories-md-is-1067-lines-split-into-hub-focused-pages.md)

## Overview
A pure documentation reorganization owned by the architect (no code, no specialist agent has work). `docs/agents/modules/repositories.md` (1067 lines) becomes a short hub; its Data model, Security, Frontend, Testing, Testing coverage and Required tests sections move, verbatim, into six pages under `docs/agents/modules/repositories/`. Every page stays under 300 lines, and every inbound and relative link is retargeted.

## Context
The current file's sections and line ranges (verified):

| Lines | Section | Destination |
|---|---|---|
| 1–44 | Title, Overview, Not built, Module boundaries and ownership | hub (stays) |
| 45–287 | Data model (Tables, Row statuses, Logical foreign keys, User deletion, Private metadata lifecycle, Ownership) | `data-model.md` |
| 288–462 | Security (Module boundaries … Abuse and performance) | `security.md` |
| 463–610 | Frontend (Placement … UI edge cases) | `frontend.md` |
| 611–766 | Testing (Tiers, Default tier by category, GitHub mocking, Detached sync and time) | `testing.md` |
| 767–908 | Concurrency and races, Access control and leaks, Module-boundary tests, Frontend tests, Cache tests, Where tests live | `testing-coverage.md` |
| 909–1057 | Required tests (Model, Security, UI) | `required-tests.md` |
| 1058–1067 | Index table | rewritten as the hub index |

All sizes are well under 300 lines (largest: `data-model.md`, about 245). `sync.md` (527 lines) is already over the cap but is out of scope for this issue; it only has its links retargeted.

## Steps

- [01 — Create the six pages and slim the hub](plan/01-create-pages-and-slim-hub.md)
- [02 — Fix relative and in-page links in moved content](plan/02-fix-links-in-moved-content.md)
- [03 — Retarget inbound links](plan/03-retarget-inbound-links.md)
- [04 — Verify](plan/04-verify.md)

## Notes
- Anchor trap: `#module-boundaries` today is the **Security** subsection (it moves to `security.md`), while the hub keeps `#module-boundaries-and-ownership`. Inbound `repositories.md#module-boundaries` links (`architecture/security.md`, `specs/issues/security.md`) must target `repositories/security.md#module-boundaries`.
- Anchor trap: `#repositories` (a table, in Data model) also collides with the H1 title of the hub. Inbound links using it as "data model" must target `repositories/data-model.md#repositories`.
- `.claude/state/issue-513.json` mentions the path but is state, not a doc link: leave it alone.
- No CI job runs on docs; verification is by script (line counts, link/anchor resolution), see step 04.
