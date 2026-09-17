# Plan: Writting: tighten absolute/vague wording in AGENTS.md flagged by Codacy Agentlinter

Issue: [112-writting--tighten-absolute-vague-wording-in-agents-md-flagged-by-codacy-agentlinter.md](../../issues/112-writting--tighten-absolute-vague-wording-in-agents-md-flagged-by-codacy-agentlinter.md)

## Overview

Codacy's Agentlinter flagged wording in `AGENTS.md` as either absolute with no stated exception, or containing a vague conditional ("unless the user says otherwise") that doesn't say how/when that override is invoked. This is a documentation-wording-only change to `AGENTS.md`: no code, no behavior change, no new folder — so it's owned directly by `architect` (root-level file, cross-cutting doc), not a specialist agent.

## Context

Resolved during discussion with the user:
- `AGENTS.md:79` ("All documentation and code comments must be written in English.") stays genuinely absolute — reworded only to remove ambiguity, not to add an escape hatch.
- `AGENTS.md:67` and `:69` ("unless the user says otherwise") get the escape hatch spelled out concretely as "unless the user explicitly asks otherwise in the conversation".
- `AGENTS.md:28` is a confirmed Codacy false positive (it already reads "...generally expected to follow, absent an explicit decision to deviate") — leave unchanged.

## Implementation Steps

### Step 1 — Spell out the docker-compose escape hatch (lines 67 and 69)

In `AGENTS.md`, replace both occurrences of "(unless the user says otherwise)" — one after "**Always run project commands through `docker-compose`.**" (line 67) and one after "Never install packages or invoke tooling (`yarn`, `npm`, `php`, etc.) directly on the host machine" (line 69) — with "(unless the user explicitly asks otherwise in the conversation)". No other wording on these lines changes.

### Step 2 — Tighten the English-only rule (line 79)

In `AGENTS.md`, reword line 79 from "All documentation and code comments must be written in **English**." to "All documentation and code comments must always be written in **English**, with no exceptions." This keeps the rule absolute while removing the ambiguity Codacy flagged.

Leave `AGENTS.md:28` unchanged — confirmed false positive.

## Files to Change

- `AGENTS.md` — reword lines 67, 69 (escape hatch clause) and line 79 (English-only rule), per Steps 1–2.

## Notes

- Wording-only change; no tests or CI job covers `AGENTS.md` prose, so no `## CI Checks` section applies.
- Do not touch `AGENTS.md:28` — confirmed as a false positive during discussion.
