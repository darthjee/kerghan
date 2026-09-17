# Issue: Writting: tighten absolute/vague wording in AGENTS.md flagged by Codacy Agentlinter

## Description
Codacy's Agentlinter flagged five wording issues in `AGENTS.md` under the `BestPractice` (documentation clarity) category: rules phrased as absolute ("must", "always") with no stated exception, and conditionals that grant an exception ("unless the user says otherwise") without saying how that override is actually communicated or by whom. Ambiguity like this is exactly what trips up an agent trying to follow the doc literally.

## Problem
1. `AGENTS.md:67` — "**Always run project commands through `docker-compose`.** (unless the user says otherwise)." — the exception clause is vague about how/when the user communicates it.
2. `AGENTS.md:69` — "Never install packages or invoke tooling ... directly on the host machine (unless the user says otherwise)." — same vague exception clause.
3. `AGENTS.md:79` — "All documentation and code comments must be written in English." — absolute, no stated exception at all; confirmed this rule is genuinely intended to be absolute (no exception).
4. `AGENTS.md:28` — "... guidelines a future module is generally expected to follow, absent an explicit decision to deviate." — flagged by the linter, but confirmed as a false positive: the line already has a clear, specific escape hatch and needs no change.

## Solution
- `AGENTS.md:67` and `:69`: replace "(unless the user says otherwise)" with "(unless the user explicitly asks otherwise in the conversation)" in both places, so the override is unambiguous about when/by whom it can be invoked.
- `AGENTS.md:79`: reword to remove ambiguity while keeping the rule absolute, e.g. "All documentation and code comments must always be written in English, with no exceptions."
- `AGENTS.md:28`: leave unchanged — the Codacy flag here is a false positive.
- Documentation-wording cleanup only — no behavior change. Owning agent: `architect` (root-level `AGENTS.md`, no code/module ownership involved).
