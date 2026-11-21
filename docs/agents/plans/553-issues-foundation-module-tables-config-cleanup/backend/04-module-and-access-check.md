# Module skeleton, wiring and the single access check

**Module.** `IssuesModule` with `ISSUES_PROVIDERS` exported for the harness (`IssuesConfig`, `IssuesAccess`, `IssuesEventsListener`). Its imports are `TypeOrmModule.forFeature(ISSUES_ENTITIES)`, `AuthModule` (for `AccountHandleService.lockExistingUser`, used by later issues) and `RepositoriesModule` (for its exported `RepositoriesService`). It also imports `IntegrationsModule`, through `integrations-github.public.js`, only once a later issue needs it. Leave `IntegrationsModule` out now unless a provider needs it. It provides `{ provide: Clock, useClass: SystemClock }` and has no controllers. Import it into `AppModule` directly (always-on), so the `user.deleted` listener exists at boot. Update the `AppModule` comment that lists always-on modules, and check that `app.module.spec.ts` still passes. Verify that there is no import cycle: Repositories must not import Issues.

**Single access check.** `IssuesAccess` is the one place that answers "this user's live project, or 404":

- `findLiveProject(userId: number, projectUuid: string, manager?: EntityManager, options?: { lock?: boolean }): Promise<IssuesProject>`
- It queries `uuid = ? AND user_id = ? AND deleted_token = 0`. With `lock`, it adds `FOR UPDATE`, the first lock of the lock order.
- It throws the existing `NotFoundException` shape with `NOT_FOUND` / `Project not found` (`specs/issues/api/errors-and-validation.md`, using the same helper Repositories uses for its `404`). A missing, foreign and deleted project all get a byte-identical error.
- `findIssueInProject(project: IssuesProject, issueUuid: string, manager?, options?)`: `404` `Issue not found` when the issue is missing or in another project. It is looked up only inside the resolved project.

No other code filters by `user_id` for access; later route and sync issues call these methods. Uuid format validation (`400`) belongs to the DTOs of the route issues.

## Files to Change
- `backend/src/issues/issues.module.ts` — new.
- `backend/src/issues/issues-access.ts` — new.
- `backend/src/app.module.ts` — import `IssuesModule`; update the always-on comment.
