# Controller route and route table

Add `@Post('projects/:projectId/issues/bulk-state.json')` to `IssuesController`. It sits under the class-level `@CachePolicy(CacheClass.UserScoped)`, uses the same param pipes and session user as its neighbours, and answers `200` (`@HttpCode(200)`, like the other POST routes that answer `200`). The handler only maps the DTO and calls the service.

Add a `bulk-state` row to `ROUTE_ROWS`:

- `service: 'issues'`, `path: project('issues/bulk-state.json')`
- `body: { issueIds: [ISSUE_ID], state: 'closed' }`, `invalidBody: { issueIds: [] }`
- `success: 200`, `method: 'bulkState'`

Add `bulkState` to `fake-issues.service.ts`. The access-matrix completeness check then passes. Add the bulk weight boundary (`used + weight = max` passes, `+1` answers `429`, and a refused call consumes nothing) where `testing.md` places it, next to the existing edit rate-limit specs.

Add a controller validation e2e row set for the DTO (`issues.controller.validation.e2e-spec.ts`). Ask `cache` to confirm that nothing goes in `navi/`.

## Files to Change

- `backend/src/issues/issues.controller.ts`: the route
- `backend/src/issues/tests/support/registered-routes.ts`: the `bulk-state` row
- `backend/src/issues/tests/support/fake-issues.service.ts`: `bulkState`
- `backend/src/issues/tests/issues.controller.validation.e2e-spec.ts`: the DTO rows over HTTP
- `backend/src/issues/tests/issue-edit-rate-limiter.spec.ts` (or the edit rate-limit db spec): the bulk weight boundary
