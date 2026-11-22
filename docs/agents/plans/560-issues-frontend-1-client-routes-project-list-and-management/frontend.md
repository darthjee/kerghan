# Frontend Plan: Issues: frontend 1 (client, routes, project list and management)

Main plan: [plan.md](plan.md)

## Context

**Specs.** The source of truth is:

- `docs/agents/specs/issues/ui.md#required-tests`
- `ui/screens-and-flows.md`
- `ui/states.md`
- `ui/decisions.md`
- `testing.md#frontend-tests`

**Backend routes.** Every route is POST and already merged:

- **Projects:**
  - `/projects/mine.json`
  - `/projects/create.json`
  - `/projects/from-repository.json`
  - `/projects/:projectId/{show,edit,repository,delete}.json`
- **Issues:**
  - `/projects/:projectId/issues.json`
  - `issues/create.json`
  - `issues/:issueId/{show,edit,delete}.json`
- **Links:**
  - `issues/import.json`
  - `issues/:issueId/{attach,unlink,refresh,retry-sync}.json`
  - `/projects/:projectId/refresh.json`

**Patterns to follow.** The Repositories module is the template:

- the Controller, Helper, Toolbar, Table, Pagination and EmptyState split
- the debounced search
- `AddStateStore`
- the Jasmine harness in `specs/support/repositoriesControllerHarness.js`
- the builders in `specs/support/repositoriesBuilders.js`
- `fetchSequence.js` as the fake transport

**Decisions from the refinement:**

- The client covers all 18 routes.
- `#/projects/:projectId` shows the header only. #561 adds the issue list, and #562 adds Refresh and Import.
- All seven routes are registered, and the issue screens point at a placeholder.
- U11 and the shared error map start here.

## Steps

- [01 — API client and ApiError.meta](frontend/01-api-client.md)
- [02 — Shared pieces: ids, error map, ConfirmModal, dirty-form prompt](frontend/02-shared-pieces.md)
- [03 — Routes, page map and header link](frontend/03-routes-and-header.md)
- [04 — Project list](frontend/04-project-list.md)
- [05 — Creation flows (explicit form and shortcut)](frontend/05-creation-flows.md)
- [06 — Project page header](frontend/06-project-page-header.md)
- [07 — Project management page](frontend/07-project-management.md)
- [08 — Security static spec and docs](frontend/08-security-and-docs.md)

## CI Checks

- `frontend`: `docker-compose run kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- Never run `yarn` or `npm` on the host. Use docker-compose only, as `CLAUDE.md` says. This issue needs no new dependency: `react-markdown` belongs to #561.
- Specs that cover an edge case carry its E-id in the description (E33 for project delete), so the backend `edge-cases.coverage.spec.ts` sweep finds them.
- The open-issue count (`openIssueCount`) is in the project object but is **not** rendered. That is #563.
- **Spec drift:** if an implementation detail forces a spec change, the same PR updates the spec. The `docs/agents/specs/issues.md` implementation-table fix in step 08 is a doc-only alignment.
