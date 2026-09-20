# Migrate the admin spec and update docs
In `admin.controller.e2e-spec.ts`, delete the private `createInMemoryRepo` (and its top-of-file "mirrors" comment) and the manual `Test.createTestingModule`/override/`cookieParser`/`ValidationPipe` boilerplate in `beforeEach`. Replace it with `({ app, userRepo } = await buildTestApp({ adminGuard: true, registerDefaultUser: false }))`, importing `buildTestApp` from `./auth.controller.e2e-test-support.js`; keep the test bodies unchanged and prune imports that become unused. `userRepo`'s type can come from the `buildTestApp` return type.

Update docs that describe the fake repository: `docs/agents/architecture/backend.md` (Testing section — mention the shared `auth/tests/support/in-memory-repo.ts` fake, and that it also supports `find`, `count`, `ilike`/`isNull`/`moreThan`) and `docs/agents/modules/auth.md` (the `admin.controller.e2e-spec.ts` bullet: built via the shared `buildTestApp`; also add the new support module).

Finally run the full backend checks: `npm run coverage` and `npm run lint`, through `docker-compose`.

## Files to Change
- `backend/src/auth/tests/admin.controller.e2e-spec.ts` — remove private fake repo and app bootstrap, use the shared `buildTestApp`.
- `docs/agents/architecture/backend.md` — describe the shared fake repository in the Testing section.
- `docs/agents/modules/auth.md` — update the admin e2e spec bullet and mention the shared support module.
