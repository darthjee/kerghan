# Frontend Plan: Issues: frontend 2 (issue list, issue page, IssueBody)

Main plan: [plan.md](plan.md)

## Overview
This plan builds the issue screens of the Issues and Projects UI against the specs. They reuse what #560 shipped:

- `IssuesClient`
- the error map
- `ConfirmModal`
- the dirty-form guard
- `listQuery`
- the project page header and the `pages/common` load helpers
- the project-list helper split

No product decision is made here. If one has to change, the same PR updates the spec.

## Context
- The specs are `docs/agents/specs/issues/ui.md#required-tests`, `ui/screens-and-flows.md` (lists, issue page and forms), `ui/states.md`, `ui/decisions.md` (S1 to S5, P1 to P5), `security.md#github-and-user-content` and `#required-tests`, `api/issues.md`, and `linking-and-sync.md#link-and-sync-states` (badge wording only).
- **Out of scope:**
  - the link panel and its state table, import, attach, unlink, re-reads, "Refresh project", "Import from GitHub", and U3, U7 and U10: #562
  - counts and bulk: #563
- The issue page leaves an empty slot between the header and the body for #562's link panel.
- The rate-limit countdown is shared and maps all three codes (`ISSUE_EDIT_RATE_LIMITED`, `ISSUE_LINK_RATE_LIMITED`, `GITHUB_RATE_LIMITED`). This issue wires only the edit form to it.
- The specs render with `renderToStaticMarkup` (`specs/support/renderedOutput.js`). There a `React.lazy` component renders its `Suspense` fallback. So the restricted-Markdown rules are unit-specified on the non-lazy renderer module, and the lazy wrapper is specified for its `<pre>` fallback.

## Steps

- [01 — Shared pieces: error codes, countdown, issue paths and validators](frontend/01-shared-pieces.md)
- [02 — IssueBody (restricted Markdown, lazy-loaded)](frontend/02-issue-body.md)
- [03 — Link column and state badge](frontend/03-link-column.md)
- [04 — Issue list on the project page](frontend/04-issue-list.md)
- [05 — Issue page](frontend/05-issue-page.md)
- [06 — Issue create and edit forms](frontend/06-issue-forms.md)
- [07 — Routes: replace the placeholder](frontend/07-routes.md)
- [08 — Security static spec and docs](frontend/08-security-and-docs.md)

## CI Checks
- `frontend`: `docker-compose run kerghan_fe yarn coverage` (CI job: jasmine)
- `frontend`: `docker-compose run kerghan_fe yarn lint` (CI job: frontend-checks)

## Notes
- Never run `yarn` or `npm` on the host. Add `react-markdown` and `remark-gfm` through `docker-compose run kerghan_fe yarn add ...`, pinned to exact versions like `react-bootstrap`, and commit `yarn.lock`.
- Specs that cover an edge case carry its E-id or U-id in the `describe`/`it` text, so the backend `edge-cases.coverage.spec.ts` sweep finds them.
- Every action button is disabled while its call is in flight (U2). The 401 refresh-and-retry and login modal of `ApiClient` cover U4: a form stays mounted with its values.
- Keep controllers free of JSX and helpers free of state, as in `pages/list/` of the project list.
