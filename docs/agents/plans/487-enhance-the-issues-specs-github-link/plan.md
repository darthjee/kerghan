# Plan: Enhance the Issues specs: GitHub link

Issue: [487-enhance-the-issues-specs-github-link.md](../../issues/487-enhance-the-issues-specs-github-link.md)

## Overview

Rewrite `docs/agents/specs/issues/github-link.md` from the decisions of the issue (link creation by a synchronous read with GitHub's values winning on attach, the repository change at zero links, unlinking, the gone and moved handling, the stored and derived link states), and keep the other spec files consistent in the same PR. Documentation only: no code, migrations or endpoints.

## Context

- The specs are the source of truth for the epic #483; a sub-issue that changes a decision updates every affected spec file in its own PR ([specs.md](../../specs.md#lifecycle)).
- #487 closes the open questions about unlinking, state names and link states, and replaces v1's blanket refusal of a repository change with "allowed only while the project has zero links" (so `projects.md` and `api.md` change).
- `model.md` gains a nullable `status_reason` column on `issues_github_links`.
- `edge-cases.md` gains E57 to E64 (owned by `github-link.md`), each with a tier, and E1, E2 and E3 name the new states.
- #488 (sync), #489 (API), #490 (security) and #491 (UI) are not enhanced yet: the specs fix outcomes and leave operation names, routes, refusal codes and wording to them.
- Owner: `architect` (no specialist agent has work in a documentation-only change).

## Steps

- [01 — Rewrite github-link.md](plan/01-rewrite-github-link.md)
- [02 — Update projects.md and api.md](plan/02-update-projects-and-api.md)
- [03 — Update model.md and the sync, ui, security and testing specs](plan/03-align-other-specs.md)
- [04 — Add the new rows to edge-cases.md](plan/04-edge-cases.md)
- [05 — Verify links, ids and open questions](plan/05-verify.md)

## Notes

- Specs describe decisions, not code: name existing code only to point at a convention.
- The exact operation names of the GitHub client, the refusal codes and payloads and the UI wording are not decided here (#488, #489, #491).
- The id-based GitHub path (`/repositories/{id}/issues/{number}`) and the `301`, `404` and `410` answers are stated as outcomes to be proven by a recorded contract spec, with the owner/name fallback written down.
- Do not edit `CLAUDE.md` or `AGENTS.md`.
