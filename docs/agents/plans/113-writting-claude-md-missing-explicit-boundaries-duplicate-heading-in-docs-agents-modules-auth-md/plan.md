# Plan: Writting: CLAUDE.md missing explicit boundaries; duplicate heading in docs/agents/modules/auth.md

Issue: [113_writting-claude-md-missing-explicit-boundaries-duplicate-heading-in-docs-agents-modules-auth-md.md](../issues/113-writting-claude-md-missing-explicit-boundaries-duplicate-heading-in-docs-agents-modules-auth-md.md)

## Overview

Two small, unrelated documentation fixes bundled into one issue: add an explicit
"boundaries" note directly to `CLAUDE.md` so Agentlinter's `completeness/has-boundaries`
check passes, and rename a duplicate heading in `docs/agents/modules/auth.md` so
markdownlint's `MD024` passes. Both are root-level/docs concerns that don't fall under any
specialist agent's owned code area, so the architect handles this directly.

## Context

- `CLAUDE.md` is intentionally a thin one-line pointer to `AGENTS.md` (the `init-claude`
  skill's established convention for this repo). Agentlinter's boundary check reads
  `CLAUDE.md` itself and finds no "don't do X" statements there, even though `AGENTS.md`
  already states several (e.g. "Never install packages ... directly on the host machine",
  "Don't add GitHub credential storage without an explicit product decision").
- `docs/agents/modules/auth.md` has `## Routes` (line 9, classic auth routes) and
  `### Routes` (line 133, inside "Device-authorization flow"). `MD024` compares heading
  text across the whole document by default (`siblings_only: false`), so these collide
  despite being at different nesting levels.
- Confirmed with the user during discussion: keep both fixes in this one issue, add the
  boundary note directly to `CLAUDE.md` (not just to `AGENTS.md`), and rename the second
  heading to `### Device-authorization routes`.

## Implementation Steps

### Step 1 — Add an explicit boundaries note to CLAUDE.md

Append a short "Boundaries" section to `CLAUDE.md`, right after the existing pointer line,
with a few concrete "don't do X" bullets pulled from what `AGENTS.md` already establishes
(no host-installed tooling, no GitHub credential storage without a product decision, keep
controllers thin) so Agentlinter's `completeness/has-boundaries` check — which reads
`CLAUDE.md` itself — finds explicit constraints without turning the file into a duplicate
of `AGENTS.md`.

### Step 2 — Disambiguate the duplicate heading in auth.md

In `docs/agents/modules/auth.md`, rename the `### Routes` heading at line 133 (inside
"Device-authorization flow") to `### Device-authorization routes`, matching how "Entity"
at line 123 already disambiguates itself from "Entities" at line 60. Update the heading's
own cross-reference text ("Same compact-table convention as 'Routes' above") if needed so
it still reads naturally after the rename.

## Files to Change

- `CLAUDE.md` — add a brief explicit "Boundaries" section under the existing `AGENTS.md`
  pointer.
- `docs/agents/modules/auth.md` — rename the `### Routes` heading at line 133 to
  `### Device-authorization routes`.

## Notes

- No local CI job runs Agentlinter or markdownlint in this repo (Codacy runs both on its
  own platform), so there's no local command to verify these two checks before pushing —
  double-check the rendered heading text and `CLAUDE.md` wording by eye.
- Keep the `CLAUDE.md` addition brief — a handful of bullets, not a restatement of
  `AGENTS.md`'s full instructions — to preserve its role as a thin pointer.
