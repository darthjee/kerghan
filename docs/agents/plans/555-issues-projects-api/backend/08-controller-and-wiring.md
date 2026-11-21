# Controller and module wiring

- **`issues/projects.controller.ts`:**
  - `@Controller()` and `@CachePolicy(CacheClass.UserScoped)`, with full paths as in `RepositoriesController`.
  - All routes are `@Post`, and each handler validates its DTO, makes one service call and shapes the response:
    - `projects/mine.json`: `200`.
    - `projects/create.json`: `201`.
    - `projects/from-repository.json`: `201` or `200`. Set the status with `@Res({ passthrough: true })` from the service result, keeping the handler thin.
    - `projects/:projectId/show.json`, `edit.json`, `repository.json` and `delete.json`: `200`, with `@Param('projectId', ParseUUIDPipe)`.
  - No `@Public()` and no `@AdminOnly()`. `JwtGuard` and `OriginGuard` are global.
- **`issues.module.ts`:**
  - Register the controller.
  - Add `ProjectsService`, `ProjectOpenIssueCounts` (and `ProjectStore`, if created) to `ISSUES_PROVIDERS`.
  - Update the module JSDoc (it says "no controller yet").
- Check that `src/core/tests/cache-policy.coverage.spec.ts` picks the new controller up, and that nothing is added to `navi/`.

## Files to Change
- `backend/src/issues/projects.controller.ts` — the seven routes (new).
- `backend/src/issues/issues.module.ts` — controller and providers.
- `backend/src/issues/tests/module-boundaries.spec.ts` / `eslint-boundary.spec.ts` — keep them green with the new imports (the Repositories public surface, and `core/` only).
