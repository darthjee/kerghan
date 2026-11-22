# Credential canary sweep and job-params allowlist

Add `issues-credential-canary.db-spec.ts` using the step-03 harness:

- **Every route:** run all 18 routes, from the matrix's row list so a new route joins automatically. Run each one as the owner in its success case and in its main refusal cases (`404`, `409`, `429`, a GitHub failure on attach and import), and as the intruder. Assert that no canary appears in the body or headers, including `error.meta`.
- **Every sync outcome:** drive the reconcile job through success, rate limit, E19 (revoked), E20 (missing), E21 (read-only), E22 (a `404` with a failing probe, and with a passing probe), E24 (owner not approved) and exhausted retries. Assert that no canary appears in captured logs, in the link and issue responses read afterwards, or in recorded job params.
- **Job params allowlist:** across the whole sweep, every `FakeWorkersService` enqueue has exactly the keys `['linkId']` with a positive integer value.
- E24 also asserts that no `fetch` call was made.

Reference the testing.md bullet and the E-ids in the `describe` and `it` titles so the edge-case citation in step 06 can find them.

## Files to Change
- `backend/src/issues/tests/issues-credential-canary.db-spec.ts`: new.
- `backend/src/issues/tests/support/registered-routes.ts`: export the route rows for reuse (from step 02).
