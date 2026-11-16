# Plan: Enhance the Issues specs: projects

Issue: [485-enhance-the-issues-specs-projects.md](../../issues/485-enhance-the-issues-specs-projects.md)

## Overview

Documentation only. Rewrite `docs/agents/specs/issues/projects.md` so it records every decision of the issue (cardinality, fields, creation paths, repository unavailable or removed, soft deletion, changing a project later, room for sharing, edge cases, required tests), and add short consequence bullets to the other spec files, each pointing back to `projects.md`. No code, migrations, endpoints or permanent docs change.

## Context

#484 created the spec set (`docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md`) with only the decisions made in the epic and one `## Open questions` section per file (items name an owner issue in parentheses). `projects.md` currently lists five open questions, all owned by #485. The decisions are in the issue body ("Solution" and "Acceptance criteria"); this plan only says where each one goes.

Rules to keep (from #484 and `docs/agents/specs.md`):
- Specs describe decisions, not code. Each file keeps a `## Required tests` section at the end, after `## Open questions`.
- A file edited for another issue's topic gets only a short decision bullet pointing to `projects.md`; its own open questions stay with their owner (#486 to #494).
- "Project" always means Kerghan's; the GitHub feature is always written "GitHub Project".
- Specs contain no real tokens, personal data or private repository names.
- Only `docs/agents/specs/` files are edited. `AGENTS.md`, `summary.md`, `product.md`, `modules/` and `specs.md` stay unchanged (they change at fold time, #492).

## Steps

- [01 — Rewrite projects.md](plan/01-rewrite-projects-md.md)
- [02 — Consequence bullets in model, github-link and sync](plan/02-model-github-link-sync.md)
- [03 — Consequence bullets in api, security, ui and edge-cases](plan/03-api-security-ui-edge-cases.md)
- [04 — Update the index](plan/04-update-the-index.md)
- [05 — Verify](plan/05-verify.md)

## Notes

- Steps 02 to 04 depend on the wording fixed in step 01; do 01 first.
- Items that remain undecided on purpose (members and roles, invitations, ownership transfer, shared visibility, archive status, restore and purge, issue moves, change or detach of a repository while no links exist) have no owner issue yet. They go under a `## Not decided` heading in `projects.md` with the reason, not under `## Open questions` (whose items must name an owner issue).
- The `projects.md` open-questions section ends up empty: remove the heading or write "None." under it, matching how other files in the set mark "nothing left" (check `edge-cases.md` and `testing.md`).
- #492 already has a comment about copying the future repository-removal rule into `modules/repositories.md`; nothing more is needed on GitHub.
- No CI job runs against these files; the check is the review in step 05.
