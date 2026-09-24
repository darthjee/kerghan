# Plan: Refactor: Tighten the CLAUDE.md wording flagged by Agentlinter

Issue: [235-refactor-tighten-the-claude-md-wording-flagged-by-agentlinter.md](../../issues/235-refactor-tighten-the-claude-md-wording-flagged-by-agentlinter.md)

## Overview
Rewrite the first Boundaries bullet in `CLAUDE.md` (the host-tooling / `docker-compose` rule) so it
names the exact exception and a defined tooling category, matching the wording #234 put in
`AGENTS.md`. The four structural Agentlinter findings are left unfixed on purpose and explained in
the PR description.

## Context
Agentlinter flags `CLAUDE.md:5` (vague instruction — the open-ended "etc." in
"(`yarn`, `npm`, `php`, etc.)") and `CLAUDE.md:6` (vague conditional — "unless the user explicitly
asks otherwise"). #234 (merged in #275) already tightened the same boundary in `AGENTS.md`:

> The only exception is when the user explicitly allows running a specific command on the host —
> either in their message in the current conversation, or through a standing user instruction (for
> example a user memory entry or a `CLAUDE.md` override).

`CLAUDE.md` is a root-level file outside every specialist's scope, so the architect owns this
change. Scope is strictly the two flagged lines. The GitHub-credentials and thin-controllers
bullets stay unchanged.

## Implementation Steps

### Step 1 — Rewrite the host-tooling Boundaries bullet
In `CLAUDE.md`, replace the current first bullet:

```markdown
- Never install packages or invoke tooling (`yarn`, `npm`, `php`, etc.) directly on the host
  machine — always run through `docker-compose` (unless the user explicitly asks otherwise).
```

with:

```markdown
- Never install packages or invoke any package manager or language runtime (e.g. `yarn`, `npm`,
  `php`) directly on the host machine — always run it through `docker-compose`. The only exception
  is a specific command the user has explicitly allowed on the host, either in their message in the
  current conversation or through a standing user instruction (for example a user memory entry).
```

Requirements:
- Do not include `AGENTS.md`'s "a `CLAUDE.md` override" example, because it would be self-referential here.
- Keep lines ≤ 100 columns and the file's existing two-space continuation indent.
- Do not weaken the boundary: the exception must require an *explicit* allowance for a *specific* command.
- Do not touch the other two bullets or the `See [AGENTS.md]` pointer line.

### Step 2 — PR description note on the unfixed findings
In the PR description, state that the four `CLAUDE.md:1` findings stay unfixed on purpose:
- no identity/persona
- no tool documentation
- only one section
- no version/update date

Explain why: `CLAUDE.md` is intentionally a thin pointer maintained by `/init-claude`, and persona,
tool docs and the `_Last updated_` date live in `AGENTS.md` and `.claude/`. No Codacy config
suppression is added.

## Files to Change
- `CLAUDE.md` — rewrite the first Boundaries bullet (Step 1).

## Notes
- Documentation-only change: no backend/frontend/proxy code, tests or lint are affected, and no
  CI job covers Markdown.
- Do not bump `AGENTS.md`'s `_Last updated_` line, since `AGENTS.md` is not modified.
- Verification happens after merge: Codacy's re-analysis of `main` should no longer report
  `CLAUDE.md:5`/`:6`, and the four `:1` findings are expected to remain.
