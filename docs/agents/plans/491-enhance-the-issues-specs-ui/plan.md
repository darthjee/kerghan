# Plan: Enhance the Issues specs: UI

Issue: [491-enhance-the-issues-specs-ui.md](../../issues/491-enhance-the-issues-specs-ui.md)

## Overview

Documentation only. Rewrite `docs/agents/specs/issues/ui.md` from the decisions recorded in the issue (screens and routes, creation and shortcut flows, project management, lists, issue page and forms, linking modals, the link and sync state table and action rules, bounded re-reads, empty/loading/error states, `ConfirmModal`, scope, UI edge cases U1 to U11, rejected alternatives, backward compatibility, S1 to S5 and P1 to P5), close its open questions and rewrite its "Required tests". Then align every spec file that defers to #491, and the frontend testing section.

## Context

- `ui.md` today is a minimum list with four open questions and several "inputs for #491" from `api.md`, `sync.md` and `security.md`.
- One correction: the old `ui.md` and `testing.md` say the project deletion confirmation shows the count of issues with unsent changes. The API only returns `unsentIssueCount` after the delete, so the confirmation warns in general terms and the count is shown afterwards (as `projects.md` already says).
- The open-issue count and bulk close/reopen screens are specified now and marked "API in #507"; #491 does not wait for #507.
- Specs describe decisions, not code. Permanent docs that describe today's code (`architecture/frontend.md`) are updated by the implementation (#492), not here.

## Steps

- [01 — Rewrite ui.md](plan/01-rewrite-ui-md.md)
- [02 — Align the specs that defer to #491](plan/02-align-related-specs.md)
- [03 — Consistency pass](plan/03-consistency-pass.md)

## CI Checks

- Documentation only; no CI job covers `docs/agents/specs/`. Check relative links and anchors by hand (Step 03).

## Notes

- No code, migrations, endpoints or dependencies are added.
- Keep edge-case ids stable: the UI rows are new U-numbered rows inside `ui.md`, separate from the E rows of `edge-cases.md`.
- If #507 lands first and changes a bulk or count detail, follow #507's `api.md` text.
