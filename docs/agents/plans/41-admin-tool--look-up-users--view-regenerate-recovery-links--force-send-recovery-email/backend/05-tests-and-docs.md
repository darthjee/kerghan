# Tests and docs

Round out coverage and bring documentation in line with the new admin surface.

- Add `backend/src/auth/tests/admin.controller.e2e-spec.ts`, following
  `auth.controller.e2e-spec.ts`'s fake-repository pattern: a real `INestApplication` via
  `Test.createTestingModule` with `User`/`PasswordResetToken` repository tokens overridden by
  small array-backed fakes, driven via `supertest`. Cover: a non-admin (or unauthenticated)
  caller gets `403`/`401` on all three routes; an admin caller gets the documented response
  shapes; `recovery-link.json`/`send-recovery-email.json` return `404` for an unknown user id;
  every response carries `X-Skip-Cache: true`.
- Update `docs/agents/modules/auth.md`: document the three new `/admin/*.json` routes (path,
  method, guard, response shape) alongside the existing route documentation, and note the
  `isAdmin` addition to the login/register/refresh/status response shapes.
- Correct the stale "No admin UI" line in `docs/agents/product.md`'s "What's already decided"
  list (see the top-level `plan.md`'s Notes) — narrow it to reflect that an admin-role-gated UI is
  now allowed, without touching the rest of that file (the data-model section stays open).

## Files to Change

- `backend/src/auth/tests/admin.controller.e2e-spec.ts` — new file.
- `docs/agents/modules/auth.md` — document new routes and response-shape changes.
- `docs/agents/product.md` — correct the stale "No admin UI" line.
