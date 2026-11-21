# Controller and module wiring

## `issues.controller.ts` — `IssuesController`

The controller is thin, like `ProjectsController`. Each route validates through its DTO, makes one `IssuesService` call and returns the result.

The class has:

- `@Controller()`;
- `@CachePolicy(CacheClass.UserScoped)`;
- paths declared in full;
- `@CurrentUser()` for the caller, and never a body field.

| Route | Status | Call |
|---|---|---|
| `POST projects/:projectId/issues.json` | `200` | `list(user.sub, projectId, toListIssuesInput(dto))` |
| `POST projects/:projectId/issues/create.json` | `201` | `create(...)` |
| `POST projects/:projectId/issues/:issueId/show.json` | `200` | `show(...)` |
| `POST projects/:projectId/issues/:issueId/edit.json` | `200` | `edit(...)` |
| `POST projects/:projectId/issues/:issueId/delete.json` | `200` | `delete(...)` |

Both path ids use `@Param(..., uuidParamPipe())`, so a non-uuid id answers `400 VALIDATION_FAILED`.

- **Route clash:** `projects/:projectId/issues.json` must not clash with any `ProjectsController` path. The project routes all end in `/<verb>.json` after `:projectId`, and `issues.json` is not one of them. Check that Nest's route ordering cannot send `projects/:projectId/issues/create.json` to another handler. The e2e covers it.

## Module

In `issues.module.ts`:

- Add `IssueStore`, `IssueMarkers`, `IssueLinkPresenter`, `IssueEditRateLimiter`, `IssuesService` and `{ provide: IssueSyncTrigger, useClass: NoopIssueSyncTrigger }` to `ISSUES_PROVIDERS`, so the DB harness wires the same graph.
- Register `IssuesController`.
- Update the module doc comment, which currently says "its only controller so far is `ProjectsController`".

## Docs

The issue routes are folded into `docs/agents/backend/routes/` by #564, not here.

## Files to Change

- `backend/src/issues/issues.controller.ts` — the controller.
- `backend/src/issues/issues.module.ts` — the providers, the controller and the doc comment.
