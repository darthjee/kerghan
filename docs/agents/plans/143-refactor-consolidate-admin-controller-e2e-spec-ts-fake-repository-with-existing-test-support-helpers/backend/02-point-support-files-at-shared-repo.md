# Point both support files at the shared repo
Delete the local `matchesCondition` and `createInMemoryRepo` definitions from both `*.e2e-test-support.ts` files and import them from `./support/in-memory-repo.js` instead. Re-export `createInMemoryRepo` (and `matchesCondition` where it was exported) from each support file so every existing spec's import (`import { buildTestApp, createInMemoryRepo } from './auth.controller.e2e-test-support.js'` etc.) keeps working unchanged. Remove now-unused imports.

Then run the whole backend suite (`npm test`) to confirm the superset repo, in particular the new `createdAt` auto-fill on all entities, breaks no existing auth/authorization-request spec (see Notes in the main plan).

## Files to Change
- `backend/src/auth/tests/auth.controller.e2e-test-support.ts` — remove local repo/matcher, import + re-export from the shared module.
- `backend/src/auth/tests/authorization-request.controller.e2e-test-support.ts` — same.
