# Plan: Docs: docs/agents/specs/issues/api.md is 362 lines — split into hub + focused pages

Issue: [528-docs-docs-agents-specs-issues-api-md-is-362-lines-split-into-hub-focused-pages.md](../../issues/528-docs-docs-agents-specs-issues-api-md-is-362-lines-split-into-hub-focused-pages.md)

## Overview

Pure documentation reorganization, owned by the architect (`docs/agents/`). `docs/agents/specs/issues/api.md` becomes a hub and its Projects, Issues, GitHub link / sync exposure, and Error catalogue / Input validation sections move to focused pages under `docs/agents/specs/issues/api/`. No content is rewritten.

## Context

The file is 362 lines, above the 300-line cap in AGENTS.md. The same pattern was applied in earlier split issues (for example #513 repositories.md and #522 github-service.md).

## Implementation Steps

### Step 1 — Create the focused pages

Move sections verbatim into `docs/agents/specs/issues/api/`, each with a short header line ("Part of the [Issues and Projects API](../api.md)"):

- `projects.md` — Projects table, Project object, listing, creation, edit, repository, delete, Refusal data (`error.meta`).
- `issues.md` — Issues table, Issue object, Issues listing, Issue create and edit, Issue delete.
- `github-link.md` — GitHub link (import/attach/unlink table, Order of checks, failures E57–E60, Attach confirmation E61, Unlink E63/E64) and How sync is exposed (Link object, Trigger routes).
- `errors-and-validation.md` — Error catalogue and Input validation.

### Step 2 — Slim the hub

`api.md` keeps the intro summary, Every route, Exposed identifiers, Open questions and Required tests, and ends with an index of the four pages, each with a one-line "when to read it". Set the hub intro so the links to `ui.md`, `model.md` etc. still resolve.

### Step 3 — Fix links

- Inside moved content, fix relative links for the new location (`model.md` becomes `../model.md`, `../../backend/...` becomes `../../../backend/...`, `../../architecture/...` becomes `../../../architecture/...`) and cross-page anchors that now live on another page (for example `#exposed-identifiers` becomes `../api.md#exposed-identifiers`, `#input-validation` becomes `errors-and-validation.md#input-validation`, `#link-object` becomes `github-link.md#link-object`).
- Update inbound links in `docs/agents/specs/issues/{model,sync,github-link,testing,security,ui,projects,edge-cases}.md` and `docs/agents/specs/issues.md` that point to anchors that moved: `api.md#attach-confirmation-e61`, `#issue-delete`, `#issues-listing`, `#error-catalogue`, `#link-object`, `#trigger-routes`. Links to `#every-route`, `#exposed-identifiers`, `#required-tests`, `#open-questions` and bare `api.md` stay.

### Step 4 — Verify

Check every page is under 300 lines, no section was lost (compare the headings and line content against the original), and no link resolves to a missing file or anchor.

## Files to Change

- `docs/agents/specs/issues/api.md` — slimmed to a hub with an index.
- `docs/agents/specs/issues/api/projects.md`, `issues.md`, `github-link.md`, `errors-and-validation.md` — new pages.
- `docs/agents/specs/issues/model.md`, `sync.md`, `testing.md`, `security.md`, `ui.md`, `projects.md`, `github-link.md`, `edge-cases.md`, `docs/agents/specs/issues.md` — inbound anchors retargeted where needed.

## Notes

- No code, no CI-relevant changes; no specialist agent is involved, and no security or data-access review is needed (docs only).
