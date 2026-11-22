# Plan: Issues: frontend 3 (linking and sync states)

Issue: [562-issues-frontend-3-linking-and-sync-states.md](../../issues/562-issues-frontend-3-linking-and-sync-states.md)

## Overview
This plan puts the GitHub link panel in the slot #561 left on the issue page (`IssueLinkPanelSlotHelper`). It adds the import and attach modals and unlink, the trigger actions with bounded re-reads, the focus re-reads on the issue page, project page and edit form (U10), and the project-header actions and repository hints. It reuses `IssuesClient`, `ProjectsClient.refresh`, `LinkStateBadge`, `GithubLink`, `ConfirmModal`, `RateLimitCountdownController` and the error map, without redoing any of them.

## Context
- The specs are the source of truth: `docs/agents/specs/issues/ui/linking-and-sync.md` (the flows, the state table, re-reading), `ui/states.md` (the error map, `ConfirmModal`, U3, U7, U10), `ui/screens-and-flows.md#lists` (the header) and `api/github-link.md` (the link object and T2, T3, T4).
- Every new controller follows the existing three-layer pattern (client, controller, render helper), with injected clients, an injected clock or timers, and `dispose()` clearing timers. Specs use `jasmine.clock()` as the fake clock, the builders of `specs/support/issuesBuilders.js`, and the existing controller harnesses.
- **Decision from the refinement:** after an edit-form save, the issue page learns of it through a one-shot, in-memory signal. The form records `{ issueId, issue }`, and the issue page consumes it once on load to start the bounded re-read. The URL does not change and nothing goes to storage (S4).

## Steps

- [01 — Shared pieces: error map, number parser, re-read scheduler, saved signal](frontend/01-shared-pieces.md)
- [02 — Link state presenter](frontend/02-link-state-presenter.md)
- [03 — Link panel and its controller](frontend/03-link-panel.md)
- [04 — Import and attach modals](frontend/04-import-attach-modals.md)
- [05 — Issue page wiring](frontend/05-issue-page-wiring.md)
- [06 — Project page: header actions, hints, import entries, focus re-read](frontend/06-project-page.md)
- [07 — U10 on the edit form](frontend/07-edit-form-u10.md)
- [08 — Security static spec and docs](frontend/08-security-and-docs.md)

## CI Checks
- `frontend`: `docker-compose run kerghan_fe yarn coverage` (CI: frontend tests and coverage)
- `frontend`: `docker-compose run kerghan_fe yarn lint` (CI: frontend lint)

## Notes
- Never run `yarn` on the host. Use docker-compose only.
- Specs that cover an edge case name its id (E1, E2, E17 to E21, E61, E63, E64, U2, U3, U7, U10) in the `describe`/`it` text, so the backend `edge-cases.coverage.spec.ts` sweep finds them.
- No new dependency is needed.
- Review: `security`, for S2 on `#N`, the attach warning (field names only), and the ids in paths (S3).
