# Plan: Docs: docs/agents/modules/integrations/github-service.md is 466 lines — split into hub + focused pages

Issue: [522-docs-docs-agents-modules-integrations-github-service-md-is-466-lines-split-into-hub-focused-pages.md](../../issues/522-docs-docs-agents-modules-integrations-github-service-md-is-466-lines-split-into-hub-focused-pages.md)

## Overview
Pure documentation reorganization, owned by the architect (no specialist owns `docs/`). `github-service.md` becomes a slim hub (summary of the subject and of what the service exports, plus an index) and its sections move, unchanged, into four pages under `docs/agents/modules/integrations/github-service/`. Same pattern as #517–#521.

## Context
The file is 466 lines, above the 300-line cap in AGENTS.md. Its sections (`##`/`###`) map to the pages proposed in the issue; resulting sizes are roughly api ≈160, status-and-errors ≈95, add-and-deletion ≈110, required-tests ≈95 lines, so every page stays well under 300.

## Implementation Steps

### Step 1 — Create the pages and slim the hub
Move content verbatim (no rewriting) and keep each heading text identical so GitHub anchors stay the same:

| New page | Sections moved (current lines) |
|---|---|
| `github-service/api.md` | Exported service, Unauthenticated calls, Endpoints and parameters, GitHub App installation tokens (7–165) |
| `github-service/status-and-errors.md` | Invalid on 401, Status compare-and-set, Usable integrations, Error mapping (166–260) |
| `github-service/add-and-deletion.md` | Access link on Add, Add re-check candidates, Shared 502 / 503 helpers, Deletion hook, Unauthenticated budget tracker (261–372) |
| `github-service/required-tests.md` | Required tests (373–466) |

Each page gets a `# ` title and a back-link to the hub. Fix relative links inside moved content for the extra directory level (`../` → `../../`, `github-app.md` → `../github-app.md`, `oauth-app.md` → `../oauth-app.md`, and `#anchor` links to sections that moved → the new page + anchor). The hub keeps the intro and a short summary of what the service exports (pointing to `github-service/api.md`), and ends with an index of the four pages, each with a one-line "when to read it".

### Step 2 — Update inbound links
Re-point every link to a moved section to its new page and anchor:

- `#exported-service`, `#unauthenticated-calls`, `#endpoints-and-parameters`, `#github-app-installation-tokens` → `github-service/api.md#…`
- `#invalid-on-401`, `#status-compare-and-set`, `#usable-integrations`, `#error-mapping` → `github-service/status-and-errors.md#…`
- `#access-link-on-add`, `#add-re-check-candidates`, `#shared-502--503-helpers`, `#deletion-hook`, `#unauthenticated-budget-tracker` → `github-service/add-and-deletion.md#…`
- `#required-tests` → `github-service/required-tests.md#required-tests`

Files found via grep that link with anchors: `docs/agents/backend/routes/repositories.md`, `docs/agents/architecture/security.md`, `docs/agents/modules/repositories/{testing,edge-cases,data-model,security,required-tests,sync}.md`, `docs/agents/modules/repositories/sync/{write-path,required-tests,github-limits}.md`, `docs/agents/modules/auth/{admin-and-events,github-handle}.md`, `docs/agents/modules/integrations/data-model.md`, `docs/agents/modules/integrations/github-app/credentials.md`. Anchor-less links to the hub (`docs/agents/summary.md`, `docs/agents/specs.md`, `modules/repositories.md`, `modules/integrations.md`, `specs/issues/security.md`) stay valid; optionally add the new pages to the `specs.md` row for the Repositories module. Re-run `grep -rn "github-service" docs AGENTS.md .claude` at the end to confirm no stale anchors, and verify all relative links in the new pages resolve and every file is under 300 lines (`wc -l`).

## Files to Change
- `docs/agents/modules/integrations/github-service.md` — slim to hub + index
- `docs/agents/modules/integrations/github-service/{api,status-and-errors,add-and-deletion,required-tests}.md` — new pages
- Inbound-link files listed in Step 2 — update anchors to the new pages
- `docs/agents/specs.md` — optionally list the new pages

## Notes
- Pure reorganization; no content changes. Keep heading text unchanged so anchors are predictable.
- Check for `.claude/agents/*.md` and `AGENTS.md` references too (none found by grep for `github-service` at planning time).
