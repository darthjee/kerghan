# Remove the original file and verify

Once every describe block from `auth.controller.e2e-spec.ts` has landed in one of the
six new files (Steps 2-7), delete the original file. Run `yarn test` and confirm the
total number of passing tests in the `AuthController (e2e)` suites matches the
original file's test count exactly (no scenario dropped or duplicated), then run
`npm run lint` to confirm the new files satisfy the project's ESLint rules (including
any per-file line-count/complexity rule this refactor is meant to fix).

## Files to Change

- `backend/src/auth/tests/auth.controller.e2e-spec.ts` — delete, now fully
  superseded by the six new files.
