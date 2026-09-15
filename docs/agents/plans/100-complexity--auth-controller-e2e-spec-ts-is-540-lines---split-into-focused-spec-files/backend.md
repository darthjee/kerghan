# Backend Plan: Complexity: auth.controller.e2e-spec.ts is 540 lines — split into focused spec files

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared test support](backend/01-extract-test-support.md)
- [02 — Split off the login spec](backend/02-split-login-spec.md)
- [03 — Split off the recovery spec](backend/03-split-recovery-spec.md)
- [04 — Split off the refresh/logout/status spec](backend/04-split-refresh-logout-spec.md)
- [05 — Split off the skip-cache spec](backend/05-split-skip-cache-spec.md)
- [06 — Split off the account spec](backend/06-split-account-spec.md)
- [07 — Split off the JwtGuard spec](backend/07-split-guard-spec.md)
- [08 — Remove the original file and verify](backend/08-remove-original-and-verify.md)

## CI Checks

- `backend`: `yarn test` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes

- Pure file-organization refactor — no assertions, request payloads, or mocked
  repository behavior should change; only their file location.
- Every new spec file keeps its own top-level `describe('AuthController (e2e)', ...)`
  and builds/tears down its own `INestApplication` via the shared `buildTestApp()`
  helper from Step 1 — none of the new files import test doubles from each other.
- Do Step 1 first and land it as part of the same change as the first spec file split
  (e.g. Step 2), since an unused `auth.controller.e2e-test-support.ts` with no
  importer would itself be dead code until at least one spec file consumes it.
- Step 8 (deleting the original file) must be the last step — every scenario currently
  in `auth.controller.e2e-spec.ts` needs to have landed in its new home first, or
  coverage silently regresses.
