# Issue: Issues: frontend 1 (client, routes, project list and management)

## Description

This issue is part of epic #483 (Issues and Projects). Kerghan gets **projects**, each optionally connected to one repository. It also gets **issues** that belong to a project and may be linked one to one to a GitHub issue. Background workers keep each linked pair in sync both ways. The specs define the feature in `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md`, and the lifecycle is in `docs/agents/specs.md`. The specification phase is finished.

This issue builds the first part of the **UI**: the shared frontend pieces and the project screens. The specs are the source of truth, and this issue makes no product decision of its own. If a decision has to change, the same PR updates the spec (`docs/agents/specs.md`, lifecycle step 2). #492 spawned the implementation issues.

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/ui.md` and `docs/agents/specs/issues/ui/screens-and-flows.md` (screens and navigation, creation flows, project management, lists)
- `docs/agents/specs/issues/ui/decisions.md` (the touch points of the existing UI)
- `docs/agents/specs/issues/ui/states.md` (empty, loading and error states; confirmations)
- `docs/agents/specs/issues/testing.md#frontend-tests`

## Depends on

- #555 (Issues: projects API), merged. The issues and link APIs (#556 to #558) are merged too, so every client route already has a backend.

## What already exists (reuse, do not redo)

All paths below are under `frontend/assets/js/` unless they start with `frontend/specs/`.

- **Client:**
  - `client/ApiClient.js` (`postJson`, plus the 401 refresh-and-retry that opens the login modal, which covers U4)
  - `client/ApiError.js`
  - `client/pickDefined.js`
  - `client/RepositoriesClient.js`. Its `list({page, perPage, filter, search})` already supports `filter: 'added'`.
- **Fake transport:**
  - `frontend/specs/support/fetchSequence.js` (`fakeResponse`, `fetchSequence`)
  - the `jasmine.clock` and `flushMicrotasks` helpers
  - `renderedOutput.js`, `elementTree.js`, `renderCapturingHandlers.js`
  - `repositoriesBuilders.js`
- **Routing:**
  - the `ROUTES` table in `utils/routing/HashRouteResolver.js` (first match wins)
  - `Router.extractParams` (see `admin/pages/AdminUserEdit.jsx`)
  - the page map in `components/helpers/AppHelper.jsx`
- **Header:** `components/common/header/helpers/HeaderHelper.jsx`, in the logged-in branch. The pending branch renders nothing.
- **List pattern:** `components/resources/repositories/pages/`, split into Controller, Helper, Toolbar, Table, Pagination and EmptyState, with a debounced search.
- **Shortcut pieces:**
  - the Add button with spinner and inline error in `RepositoriesTableHelper.jsx`
  - `AddStateStore.js`
  - `addErrorMessages.js`
- **Modals:** the react-bootstrap login modal. There is no shared confirm modal yet. The `window.confirm` in `AdminUsersController.js` stays as it is.

## Task

- **API client, all routes.** A Projects/Issues client that covers every backend route that exists today:
  - **Projects:** `mine`, `create`, `from-repository`, `show`, `edit`, `repository`, `delete`
  - **Issues:** `list`, `create`, `show`, `edit`, `delete`
  - **Links:** `import`, `attach`, `unlink`, `refresh`, `retry-sync`, project `refresh`

  The client covers request building (path encoding of ids) and error mapping, all specified against the fake transport. `ApiError` gains `meta`, and `buildApiError` reads `error.meta` (`projectId`, `linkCount`). #561 and #562 consume the client as is. `bulk-state` is added by #563.
- **Shared error map.** A shared error-message module. It holds:
  - the project codes (`PROJECT_*`)
  - `VALIDATION_FAILED`
  - `GITHUB_UNAVAILABLE`

  #561 and #562 add the rate-limit and link codes.
- **`ConfirmModal`.** A shared component, reused by #561 and #562.
- **Dirty-form prompt (U11).** Built on `ConfirmModal` and applied to the project create and edit forms. It is generic, so the issue forms in #561 reuse it.
- **Routes and header link.** Register all seven Issues/Projects routes in the spec's literal-before-param order.
  - The project list, project creation, project page and project management routes get real screens.
  - The issue routes map to a placeholder page that #561 and #562 replace, so the routes test lands complete here.
  - The header link shows for logged-in users only, never for pending users.
- **Project list.** It includes:
  - rows and columns, except the open-issue count
  - the hash `search` and `page`
  - loading, Retry and the empty states ("No projects", "No projects match")
  - U5 and U6
- **Creation flows.** Both the explicit form and the from-repository shortcut, with the client-side limits and the server validation errors.
  - The repository picker shows the "Add a repository first" hint when the unsearched `filter: 'added'` call returns `pagination.total === 0`.
- **Project page `#/projects/:projectId`: header only.** It shows:
  - the name
  - the description as plain text
  - the repository badge, or "No repository"
  - the Edit action
  - the "Project not found" view for a 404 and for a malformed id (U1)

  #561 adds the issue list, and #562 adds "Refresh project" and "Import".
- **Project management `#/projects/:projectId/edit`.** It covers:
  - editing the name and description
  - connecting, changing and disconnecting the repository
  - deletion behind `ConfirmModal`, using `ApiError.meta` (`linkCount`) and U9

## Out of scope

- The open-issue count on project rows, and bulk state: #563.
- The issue list, the issue page and forms, `IssueBody`, and the rate-limit countdowns: #561.
- Linking, sync states, re-reading, "Refresh project", "Import", and U3/U7/U10: #562.

## Acceptance criteria

- Every Required test in `ui.md#required-tests` that falls in this scope is implemented, on the tier given by [`testing.md`](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs/issues/testing.md). That covers:
  - the routes and header
  - creation
  - project management
  - the project list
  - the project-side empty, loading and error states
  - `ConfirmModal`
  - U1, U2, U4, U5, U6, U8 (names), U9 and U11
  - S1 (static, for names and descriptions), S3 (uuid checks, path encoding, the `..%2Fadmin` hash), S4 and S5
- Every client route has fake-transport specs for its request and its error mapping, including `ApiError.meta`.
- Frontend specs that cover an edge case carry its E-id (for example E33 for project deletion), so the backend `edge-cases.coverage.spec.ts` sweep finds them.
- No decision differs from the specs. If one has to, the same PR updates the spec. The same PR also aligns the implementation table in `docs/agents/specs/issues.md`, which lists this issue as building only against `screens-and-flows.md` and `decisions.md`, with the *Builds against* list above.
- The frontend checks pass:
  - `docker-compose run kerghan_fe yarn coverage`
  - `docker-compose run kerghan_fe yarn lint`

## Notes

- **Responsible agent:** `frontend`.
- **Review:** `security`. Project names and descriptions are rendered as text, never as markup (S1). Ids in paths are validated and encoded (S3).
