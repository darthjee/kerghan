# Plan: Spawn the Issues and Projects implementation issues

Issue: [492-spawn-the-issues-and-projects-implementation-issues.md](../../issues/492-spawn-the-issues-and-projects-implementation-issues.md)

## Overview

Turn the finished Issues and Projects specs (`docs/agents/specs/issues.md` and `docs/agents/specs/issues/`) into 12 ordered implementation sub-issues of the epic #483. Each sub-issue names the spec files it builds against and the issues it waits for. The dependencies are also set as GitHub "blocked by" relationships. Then the spec docs are updated so that every reference to "#492" as the implementation or fold issue points at the right new issue. No code, migrations or endpoints are added.

## Context

- The spec phase is done: #484 to #491, #493 and #494 are closed. #507 (the API spec for open-issue counts and bulk close/reopen) is still open and blocks one sub-issue.
- #479 (background workers) is closed, so the sync workers dependency is already satisfied. It is still recorded in that sub-issue's body.
- Decisions taken in the discussion of #492:
  - The parent is the epic #483 (native sub-issues), beside the spec issues.
  - Each implementation issue ships the Required tests of the spec files it builds against. A final security verification issue (row 7) covers the cross-cutting checks.
  - Counts and bulk close/reopen get their own issue (row 11), blocked by #507.
  - Dependencies are written in each body and set as GitHub "blocked by" relationships. The frontend stays at three issues.
- The split table (rows 1 to 12) in the issue file is the source of truth for titles, scope, spec files and dependencies.
- This is architect-only work (`gh` calls and docs under `docs/agents/specs/`). No specialist agent has work.

## Steps

- [01 — Draft the sub-issue bodies](plan/01-draft-sub-issue-bodies.md)
- [02 — Create the sub-issues under #483](plan/02-create-sub-issues.md)
- [03 — Set the blocked-by relationships](plan/03-set-blocked-by.md)
- [04 — Point the specs at the new issues](plan/04-update-spec-references.md)
- [05 — Verify coverage and report](plan/05-verify-and-report.md)

## Notes

- Creating GitHub issues is outward-facing and cannot be undone cleanly. Create them once, in order, and record every `ID=` in a mapping file in the scratchpad (row → issue number) before moving on. If a run is interrupted, read the mapping and the open sub-issues of #483 first, so no duplicate is created.
- The body drafts are temporary (scratchpad), not committed. Issue files under `docs/agents/issues/` are created later by each sub-issue's own pipeline (`discuss-issue` / `auto-new-issue`), as for the spec issues.
- `spawn_issue.sh` links a new issue to a parent and, with `--as-subissue`, as a native sub-issue. Use `#483` as the parent, not #492.
- If the GitHub dependencies API (`/issues/{n}/dependencies/blocked_by`) refuses a call, the bodies still carry the dependency lines. Note the failure in the PR description instead of failing the issue.
- The labels of the new issues follow the repository's issue-tag conventions (`docs/agents/architecture/issue-tags.md`, if present). Without a convention, add none. Each issue goes through `discuss-issue` before it is planned.
- The open question of `model.md` (how the future repository-removal feature learns that a live project uses a repository) has no owner and is not turned into an issue.
- `AGENTS.md` and `CLAUDE.md` are not touched by this issue. The fold issue (row 12) proposes their edits and asks the user first.
