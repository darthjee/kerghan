# Plan: Write the general specs for Issues and Projects

Issue: [484-write-the-general-specs-for-issues-and-projects.md](../../issues/484-write-the-general-specs-for-issues-and-projects.md)

## Overview

Documentation only. Create the first version of the Issues and Projects specs: the index `docs/agents/specs/issues.md` and nine files in `docs/agents/specs/issues/`, then register the feature in `docs/agents/specs.md`. The first version records only the decisions already made in epic #483, and lists every open point under a per-file `## Open questions` section with an owner issue. No code, migrations, endpoints or frontend changes, and no other permanent doc (`product.md`, `AGENTS.md`, `summary.md`) is edited.

## Context

- Spec convention and lifecycle: `docs/agents/specs.md`. Its Conventions section currently says each feature has a `README.md` index, so this layout needs an exception. The fold issue at the end of the epic deletes both `issues.md` and `issues/`.
- `docs/agents/specs/` does not exist yet; the first file creates it. `docs/agents/issues/` (issue drafts) is a different folder, and the index must say so.
- Format precedent for spec files: the repositories specs (#445, #450, #451), recoverable from git history, for example `git show dbb4af3:docs/agents/specs/repos/model.md` and its siblings in that commit, and `edge-cases.md` / `testing.md` added in `76ded21` and `8b361a2` under `docs/agents/specs/repos/`.
- No specialist agent owns documentation: the only agent whose scope covers `docs/` is the `architect` coordinator, so the plan is a single, ownerless plan.
- Owner issues for open questions: `projects.md` #485, `model.md` #486, `github-link.md` #487, `sync.md` #488, `api.md` #489, `security.md` #490, `ui.md` #491, `edge-cases.md` #493, `testing.md` #494.

## Steps

- [01 — Register the feature in specs.md](plan/01-register-the-feature-in-specs-md.md)
- [02 — Write the index issues.md](plan/02-write-the-index.md)
- [03 — Write the seven core spec files](plan/03-write-the-core-spec-files.md)
- [04 — Write edge-cases.md and testing.md](plan/04-write-edge-cases-and-testing.md)
- [05 — Verify links, owners and content](plan/05-verify.md)

## CI Checks

No CI job covers documentation. Verification is manual, in step 05.

## Notes

- Write everything in English. Specs describe decisions, not code.
- Depth rule: no proposed defaults and no invented detail. Anything not decided in the epic is an open question with an owner.
- Examples use obviously fake values; no real tokens, secrets, personal data or private repository names.
- Do not restate the epic's wording loosely: copy decisions faithfully from the issue's "Decisions already made in the epic".
