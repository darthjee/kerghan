# Write testing.md

Rewrite `docs/agents/specs/issues/testing.md` following the issue's Solution section. Keep the header (purpose and link to the Issues and Projects specs). Sections, in order:

1. Intro: what to test lives in each file's "Required tests"; this page says how; no test calls the real GitHub, reads the wall clock or loops to catch a race.
2. Tiers (Unit, E2E with fakes, DB-backed, Static, Frontend) and a pointer to the existing DB-backed tier (`*.db-spec.ts`, `yarn test:db`, `make db-tests`, `_test` schema guard) instead of redefining it.
3. Default tier by category (the table of the issue) and exception tags `(db)`, `(e2e)`, `(unit)`, `(static)`, `(race)`, `(engine)`.
4. Fixtures: the extended `FakeIntegrationsGithubService` (scripted answers, call log, deferred answers), builders (`githubIssue`, `githubPullRequest`, `issuePage` plus the reused error builders), the required fidelity contract spec, the no-network guard, `FakeClock` (E7 timestamps and the E17 reset), DB seed builders and the intruder user.
5. Worker tests on #479: thin jobs, `FakeWorkersService` (`register`, `enqueue`, `runAll`, ids-only params), the few real-engine specs (`resetDekuSwarm`, 1 ms cooldown, deferreds), and the DB-backed restart case (E14, E51).
6. Races: (a) DB parallelism with invariants (E34, E35, E42, E46, E48, E49); (b) scripted interleaving tagged `(race)` (E41, E44, E32, E15).
7. Security verification: canary sweep (responses, headers, logs, job params), job-param id allowlist, route access matrix, two-user baseline, static specs (forbidden tokens, column allowlist, cache-policy coverage), frontend static spec for text-only description.
8. Frontend tests: client, controller and render layers, builders, link and sync state views, retry and unlink actions, deletion confirmation.
9. Coverage per area: one table (model, projects, link, sync, API, security, UI) with tiers, fixtures, the owning file's "Required tests" and the E-ids.
10. Open questions: none, or only items with a reason and an owner issue (for example the exact operation names of the GitHub issue client: #487, #488; rendering of GitHub content: #490).
11. Required tests: a short list of the checks of the testing infrastructure itself (fidelity contract, no-network guard, access matrix completeness, static specs, ids-only job params, real-engine specs, restart spec).

## Files to Change

- `docs/agents/specs/issues/testing.md` — replace the stub with the full strategy.
