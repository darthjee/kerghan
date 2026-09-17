# Issue: Writting: CLAUDE.md missing explicit boundaries; duplicate heading in docs/agents/modules/auth.md

## Description
Two independent Codacy findings surfaced by automated review:

1. Agentlinter's `completeness/has-boundaries` check flags `CLAUDE.md:1` for defining no boundaries or constraints — the file only points to `AGENTS.md`, and the linter evaluates `CLAUDE.md` itself rather than following the link.
2. `markdownlint`'s `MD024` flags a duplicate heading: `docs/agents/modules/auth.md` has `## Routes` (line 9) and `### Routes` (line 133). MD024 compares heading text across the whole document by default (`siblings_only: false`), so the two collide despite being at different nesting levels.

## Problem
- `CLAUDE.md` is intentionally a thin one-line pointer to `AGENTS.md` (the `init-claude` skill's established convention for this repo) and never states its own boundaries directly — so a linter that only reads `CLAUDE.md` sees no "don't do X" statements, even though `AGENTS.md` already states several (e.g. "Never install packages ... directly on the host machine", "Don't add GitHub credential storage without an explicit product decision").
- `docs/agents/modules/auth.md`'s "Device-authorization flow" section reuses the heading `### Routes` for its own per-endpoint table, even though the file already has a top-level `## Routes` section for the classic auth routes — same text, different nesting level, still a duplicate under MD024's default behavior.

## Expected Behavior
- `CLAUDE.md` satisfies Agentlinter's boundary check without abandoning its role as a thin pointer to `AGENTS.md`.
- Every heading in `docs/agents/modules/auth.md` is textually unique, so markdownlint's MD024 passes.

## Solution
1. Add a short, explicit boundaries note directly in `CLAUDE.md` (a few bullet lines, not a rewrite) so the linter — which reads `CLAUDE.md` itself — sees concrete "don't do X" constraints, while keeping the existing pointer to `AGENTS.md` for the full instructions.
2. Rename the second `### Routes` heading in `docs/agents/modules/auth.md:133` to something more specific (e.g. `### Device-authorization routes`), matching how "Entity" at line 123 already disambiguates itself from "Entities" at line 60.

## Benefits
- Passes both flagged Codacy checks.
- `CLAUDE.md` gains a quick, scannable "what not to do" without duplicating `AGENTS.md`'s full instructions.
- Clearer, unambiguous heading names in `auth.md` for anyone (human or agent) navigating the doc or linking to a specific section.
