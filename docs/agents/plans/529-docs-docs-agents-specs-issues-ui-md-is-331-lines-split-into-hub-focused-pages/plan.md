# Plan: Docs: docs/agents/specs/issues/ui.md is 331 lines — split into hub + focused pages

Issue: [529-docs-docs-agents-specs-issues-ui-md-is-331-lines-split-into-hub-focused-pages.md](../../issues/529-docs-docs-agents-specs-issues-ui-md-is-331-lines-split-into-hub-focused-pages.md)

## Overview

Pure docs reorganization owned by the architect (no specialist agent has work). `docs/agents/specs/issues/ui.md` (331 lines) becomes a hub, and its sections move verbatim into four pages under `docs/agents/specs/issues/ui/`, the same pattern as #528 (`api.md` + `api/`). Inbound links to moved sections are retargeted.

## Context

AGENTS.md caps docs at 300 lines. The proposed page boundaries from the issue match the file's current sections, so they are kept (line numbers refer to the current `ui.md`):

| Page | Sections moved | Lines | Approx. size |
|---|---|---|---|
| `ui/screens-and-flows.md` | Screens and navigation, Creation flows, Project management, Lists, Issue page and forms | 7-105 | ~100 |
| `ui/linking-and-sync.md` | Linking flows, Link and sync states, Re-reading after a trigger | 106-176 | ~75 |
| `ui/states.md` | Empty, loading and error states, Confirmations, Scope, UI edge cases | 177-256 | ~85 |
| `ui/decisions.md` | Rejected alternatives, Backward compatibility, Performance and security | 257-309 | ~57 |
| `ui.md` (hub) | Title, intro (lines 1-5), Open questions, Required tests, Pages index | 1-5, 311-331 | ~45 |

Each new page starts with a title, a one-line scope sentence and a "Back to the [Issues and Projects UI](../ui.md) hub." line, as `api/projects.md` does. Headings keep their exact text, so the anchors only change page.

## Implementation Steps

### Step 1 — Create the pages and slim the hub

- Create the four pages with the section text copied unchanged (no rewording).
- Fix relative links inside moved content so they resolve from `ui/`: `projects.md#deletion`, `github-link.md#not-decided`, `edge-cases.md`, `security.md#bodies-restricted-markdown` all gain a `../` prefix.
- Turn the plain-text cross-page pointers into links: "see Link and sync states" (Issue page) to `linking-and-sync.md#link-and-sync-states`; "see Lists" (Link and sync states) to `screens-and-flows.md#lists`; "Screens and navigation" (Lists) stays same-page; "Re-reading after a trigger" (P4) to `linking-and-sync.md#re-reading-after-a-trigger`.
- Reduce `ui.md` to: title and intro paragraph, Open questions (its `[Scope](#scope)` link becomes `ui/states.md#scope`), Required tests (unchanged), and a final `## Pages` index with a one-line "read when" description per page.

### Step 2 — Retarget inbound links and verify

- `docs/agents/specs/issues/github-link.md` (lines 6, 77, 94), `sync.md` (71, 129, 214), `security.md` (47, 219), `edge-cases.md` (135) and `api/github-link.md` (82): `ui.md#link-and-sync-states` to `ui/linking-and-sync.md#link-and-sync-states` (`../ui/...` from `api/`).
- `api/github-link.md` (81): `../ui.md#re-reading-after-a-trigger` to `../ui/linking-and-sync.md#re-reading-after-a-trigger`.
- `api/errors-and-validation.md` (44): `../ui.md#empty-loading-and-error-states` to `../ui/states.md#empty-loading-and-error-states`.
- `edge-cases.md` (135): `ui.md#ui-edge-cases` to `ui/states.md#ui-edge-cases`.
- Links to `ui.md`, `ui.md#required-tests` and `ui.md#open-questions` (hub-owned) stay as they are.
- Verify: `wc -l` on the hub and every page is under 300; `grep -rn 'ui\.md#'` over `docs/`, `AGENTS.md` and `.claude/` shows no anchor that no longer exists in the hub; every relative link in the new pages resolves; concatenated section content equals the original (diff against `git show HEAD:docs/agents/specs/issues/ui.md`, ignoring link edits and the added headers).

## Files to Change

- `docs/agents/specs/issues/ui.md` — slimmed to a hub with a Pages index.
- `docs/agents/specs/issues/ui/screens-and-flows.md` — new.
- `docs/agents/specs/issues/ui/linking-and-sync.md` — new.
- `docs/agents/specs/issues/ui/states.md` — new.
- `docs/agents/specs/issues/ui/decisions.md` — new.
- `docs/agents/specs/issues/github-link.md`, `sync.md`, `security.md`, `edge-cases.md` — retarget anchors.
- `docs/agents/specs/issues/api/github-link.md`, `api/errors-and-validation.md` — retarget anchors.

## Notes

- No CI job covers markdown in this repo's code folders; verification is the `wc -l` and link checks above.
- `docs/agents/specs/issues.md` links `issues/ui.md#open-questions`, which stays on the hub, so it needs no change. `AGENTS.md` and `.claude/` have no references to `ui.md`.
