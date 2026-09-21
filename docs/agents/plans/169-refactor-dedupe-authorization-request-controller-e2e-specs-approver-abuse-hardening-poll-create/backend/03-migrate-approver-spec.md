# Migrate the approver spec
Replace the outer scaffold with `useTestApp()` and replace all five `POST .../mine.json` request blocks (four `mine` tests plus the `X-Skip-Cache` `mine` test) with `postMine(ctx.app, ownerCookie)`, keeping each test's own expectations. The unauthenticated `mine` test (no cookie, expects 401) keeps its own request since it doesn't fit `postMine`'s `.expect(201)`. Drop unused imports.

## Files to Change
- `backend/src/auth/tests/authorization-request.controller.approver.e2e-spec.ts` — use `useTestApp()` and `postMine`.
