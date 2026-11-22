# Test doubles and cross-module prerequisites

Add the building blocks the sync needs that do not exist yet:

- **Scheduler:** `core/scheduler.ts`, an abstract `Scheduler` (`schedule(at: Date, fn): handle`, `cancel(handle)`) with a `SystemScheduler` on `setTimeout`. Add a `FakeScheduler` in `core/tests/support/` that `FakeClock` drives: `advance` fires due callbacks. The rate-limit timers and every time-dependent spec use it.
- **`FakeWorkersService`:** add it under `workers/tests/support/`. It records `register` and `enqueue` (name and params), and `runAll()` runs the captured jobs on demand, in the style of Repositories' `CapturingLauncher`. It exposes the call log for the job-params allowlist assertion (numeric ids only).
- **deku-swarm typings:** declare the `maxRetries` and `cooldown` getters on `Job` in `types/deku-swarm.d.ts` that a class may override. Check them against the installed deku-swarm version (1.12.0).
- **Auth:** export an approval check, for example `AccountHandleService.isApproved(userId): Promise<boolean>` (true only for `UserStatus.APPROVED`, false for a missing user). It backs guard 2 (E24); Issues may not query `auth_users` itself.
- **Repositories:** export a method that persists a rename from a `301` (E65), for example `RepositoriesService.applyRename(userId, repositoryId, renamedTo)`. It refreshes the stored owner and name, and is mirrored on `FakeProjectRepositories`.
- **Errors:** add `ISSUE_LINK_GONE` to `core/error-codes.ts` and a `issueLinkGone()` factory (`409`) to `issues/issues-http-errors.ts`.
- **Module:** `IssuesModule` imports `WorkersModule`. Everything new must be overridable through `ISSUES_PROVIDERS`, so the DB harnesses can swap in `FakeWorkersService`, `FakeScheduler` and the fake writer.

Unit-spec each new piece.

## Files to Change

- `backend/src/core/scheduler.ts` (new), `backend/src/core/tests/support/fake-scheduler.ts` (new) and specs
- `backend/src/workers/tests/support/fake-workers.service.ts` (new)
- `backend/src/types/deku-swarm.d.ts`: the getters
- `backend/src/auth/account-handle.service.ts` and spec: `isApproved`
- `backend/src/repositories/repositories.service.ts` and spec, `backend/src/issues/tests/support/fake-project-repositories.ts`: the rename method
- `backend/src/core/error-codes.ts`, `backend/src/issues/issues-http-errors.ts`
- `backend/src/issues/issues.module.ts`: the `WorkersModule` import and new providers
- `backend/src/issues/tests/support/issues-db-harness.ts`, `issues-http-db-harness.ts`: the overrides
