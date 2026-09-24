# Issue: Refactor: Tighten the CLAUDE.md wording flagged by Agentlinter

## Description
Codacy's Agentlinter reports 6 findings on `CLAUDE.md`. This file is deliberately thin: it points to `AGENTS.md` and adds a short **Boundaries** list.

## Problem
`CLAUDE.md` — 6 findings (all Info):

- `:5` vague instruction: the docker-compose bullet lists the forbidden tooling as "(`yarn`, `npm`, `php`, etc.)"
- `:6` vague conditional: the same bullet's exception, "(unless the user explicitly asks otherwise)", does not say what counts as asking or where the permission can come from
- `:1` no identity/persona, no tool documentation, only one section, no version/update date

`AGENTS.md` already tightened the same boundary in #234 (merged in #275). It now says the only exception is "when the user explicitly allows running a specific command on the host — either in their message in the current conversation, or through a standing user instruction". `CLAUDE.md` still has the old, vaguer wording, so the two files disagree.

## Expected Behavior
- The docker-compose Boundaries bullet names the exact exception and matches `AGENTS.md`: a *specific* command the user has *explicitly* allowed on the host, either in the current conversation or through a standing user instruction such as a user memory entry.
- The open-ended "etc." becomes a defined category, for example "any package manager or language runtime (e.g. `yarn`, `npm`, `php`)".
- `CLAUDE.md` stays a thin pointer to `AGENTS.md`. No boundary gets weaker.

## Solution
- Rewrite only the first Boundaries bullet (lines 5–6) in `CLAUDE.md`, matching the wording #234 put in `AGENTS.md`. Leave out AGENTS.md's "a `CLAUDE.md` override" example, since it would be self-referential here.
- Leave the other two Boundaries bullets (GitHub credentials, thin controllers) unchanged. Agentlinter did not flag them.
- Leave the four structural `:1` findings (persona, tool docs, single section, version/date) unfixed on purpose. Persona, tool list and the update date live in `AGENTS.md`, which gained a `_Last updated_` line in #234. `/init-claude` keeps `CLAUDE.md` intentionally minimal. Explain this in the PR description.
- Documentation-only change. No code, tests or tooling are affected.

## Benefits
- Removes 2 findings and documents why the other 4 are intentional.
- Keeps `CLAUDE.md` and `AGENTS.md` consistent on the host-tooling boundary.

## Verification
- After merge, Codacy's re-analysis of `main` no longer reports the `:5`/`:6` findings on `CLAUDE.md`. The four `:1` structural findings are expected to remain.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
