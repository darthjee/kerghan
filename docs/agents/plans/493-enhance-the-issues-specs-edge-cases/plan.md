# Plan: Enhance the Issues specs: edge cases

Issue: [493-enhance-the-issues-specs-edge-cases.md](../../issues/493-enhance-the-issues-specs-edge-cases.md)

## Overview

Write `docs/agents/specs/issues/edge-cases.md` as the index matrix of edge cases (rows `E1…E33` plus indexed rows from `projects.md` and `model.md`), and make the other spec files consistent in the same PR. Documentation only: no code, migrations or endpoints.

## Context

- #486 is merged: `model.md` holds the data rows, the marker and cleanup contracts; `projects.md` holds the project rows. Both stay the owners of their rules.
- #487, #488 and #490 are not enhanced yet, so outcomes that depend on them are fixed here as `Contract` rows and the owner issue refines the mechanics.
- Shape model: the Repositories matrix (`docs/agents/modules/repositories/edge-cases.md`): an index, not a second source of truth; a change of outcome is made in the owning file first.
- Specs describe decisions, not code; no real tokens, secrets or personal data; "project" is Kerghan's, "GitHub Project" is GitHub's.

## Steps

- [01 — Write edge-cases.md](plan/01-write-edge-cases.md)
- [02 — Align sync, github-link and security](plan/02-sync-github-link-security.md)
- [03 — Align model, ui and api](plan/03-model-ui-api.md)
- [04 — Verify](plan/04-verify.md)

## Notes

- Only files under `docs/agents/specs/` change. `CLAUDE.md`, `AGENTS.md` and the permanent docs are untouched until the fold issue (#492).
- The four open questions of `edge-cases.md` are fixed by the issue: states and GitHub's answers (#487); retry values and integration choice (#488); the retry-sync route and exposure of states (#489, #491); per-field timestamps (no owner yet).
- No CI check applies to documentation-only changes beyond the repository's usual ones.
