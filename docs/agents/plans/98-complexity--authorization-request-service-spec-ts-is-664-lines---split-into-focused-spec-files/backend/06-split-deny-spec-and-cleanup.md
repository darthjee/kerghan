# Split off the `deny` spec file and remove the original

Create `backend/src/auth/tests/authorization-request.service.deny.spec.ts`, moving the `describe('deny', ...)` block (current lines 724–819, the end of the file) into it, wrapped in the same outer `describe('AuthorizationRequestService', () => { ... })`. Import the shared test context from `authorization-request.service.test-support.ts` (Step 1).

Once all 5 method spec files (Steps 2–6) and the shared helper (Step 1) are in place and every scenario from the original file has a new home, delete the original `authorization-request.service.spec.ts`. Run `npm run coverage` from `backend/` and compare the total test count and coverage percentages for `authorization-request.service.ts` against the pre-split baseline to confirm nothing was lost in the move. Also run `npm run lint` to confirm the new files pass ESLint's 300-line/complexity-10 rules.

## Files to Change
- `backend/src/auth/tests/authorization-request.service.deny.spec.ts` — new file; contains only the `deny` scenarios (owner denies an open row / expired-but-open still denies / wrong owner / not-open), importing scaffolding from `authorization-request.service.test-support.ts`.
- `backend/src/auth/tests/authorization-request.service.spec.ts` — deleted; fully superseded by the helper plus the 5 new per-method spec files.
