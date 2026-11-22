# Cross-controller route access matrix

Replace `projects.controller.access.e2e-spec.ts`, `issues.controller.access.e2e-spec.ts` and `issue-links.controller.access.e2e-spec.ts` with one table-driven spec, `issues-routes.access-matrix.e2e-spec.ts`. It has one row per route (path, method, a valid body, which path ids it takes) and one `it.each` per column:

- `401` without a session;
- `OriginGuard` `403` with a foreign origin;
- `X-Skip-Cache: true` and `Cache-Control: no-store` on success, on handler errors and on validation errors (`expectNeverCached`);
- no `GET`: the same path with `GET` answers `404`;
- a malformed `projectId` or `issueId` answers `400 VALIDATION_FAILED` (moved here from `projects.controller.validation.e2e-spec.ts`);
- the caller id always comes from the session, never from the body;
- **no admin access (new):** an `isAdmin: true` session gets the same `404` as a missing project on the owner's project and issues. Seed an admin user in `build-issues-test-app.ts`.

**Completeness check:** move the `registeredRoutes()` helper to `support/` and make it collect the routes of **every** controller registered by the Issues module, found from its module metadata rather than a fixed list. Assert that the sorted list equals the matrix rows, so a new route or controller without a row fails.

The real-database 404 identity (foreign, deleted and missing projects answer byte-identical bodies, and another project's issue answers the same `404`) stays in `*.routes.db-spec.ts`. Make sure each route of the matrix has such a row there. Add one table-driven DB spec, `issues-routes.not-found.db-spec.ts`, that covers every route with a path id against the intruder, a deleted project and a missing id, comparing the bodies.

## Files to Change
- `backend/src/issues/tests/issues-routes.access-matrix.e2e-spec.ts`: new.
- `backend/src/issues/tests/issues-routes.not-found.db-spec.ts`: new; uses the intruder from step 01.
- `backend/src/issues/tests/support/registered-routes.ts`: new; cross-controller route discovery.
- `backend/src/issues/tests/support/build-issues-test-app.ts`: seed an admin user.
- `backend/src/issues/tests/{projects,issues,issue-links}.controller.access.e2e-spec.ts`: delete them once every assertion is in the matrix.
- `backend/src/issues/tests/projects.controller.validation.e2e-spec.ts`: drop the uuid case now covered by the matrix.
