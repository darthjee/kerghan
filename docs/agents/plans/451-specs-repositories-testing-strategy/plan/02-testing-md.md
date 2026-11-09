# Write testing.md

Create `docs/agents/specs/repos/testing.md` from the issue's Solution. It is the single home of the strategy. The intro line reads: "Part of the [Repositories specs](README.md)."

Sections, in this order:

1. **Tiers:**
   - unit (`*.spec.ts`);
   - e2e with fakes (`*.e2e-spec.ts`, the in-memory repo);
   - DB-backed (`*.db-spec.ts`, real MySQL 8, `yarn test:db`, serial, dedicated schema, migrations once, truncate per test, docker-compose locally, its own CI job with `cimg/mysql:8.0`, added by the first implementation sub-issue that needs it);
   - static (source-scanning `*.spec.ts`);
   - frontend Jasmine.
2. **Category → default tier table.**
   - DB-backed: claims, first-use row, `run_id` guards, unique keys, per-page transactions, compare-and-set, Add's conditional write, prune/deletion queries, `bigint`, migrations.
   - Routes, DTOs, guards, service flow and error mapping: e2e or unit.
   - Integrations GitHub client: unit at the `fetch` level.
   - UI: frontend.
   - Explain the exception tags (`(db)`, `(e2e)`, `(unit)`, `(static)`, `(race)`) used in the "Required tests" sections.
3. **GitHub mocking:**
   - the two layers;
   - `FakeIntegrationsGithubService`: scripting per (`integrationId` | `null`, operation, page), a call log, deferred answers;
   - the typed builders, listed by name;
   - the fake-fidelity contract spec;
   - the no-network guard (Repositories and Integrations harnesses only).
4. **Detached sync and time:** `CapturingLauncher` / `runAll()`, `FakeClock` `set` / `advance`, and `jest.useFakeTimers` only for the HTTP timeout. Link to the rules in `sync.md`.
5. **Concurrency and races:**
   - (a) true parallelism on the DB tier with invariant assertions, no repeat loops;
   - (b) scripted interleaving at GitHub-call and launcher pause points, listing the competing actions;
   - Integrations-level races (token single-flight, budget acquires);
   - no production test hooks.
6. **Access control and leaks:**
   - the route access matrix (its routes, rules and completeness check);
   - the canary sweep (its canaries, flow and assertion);
   - the two-user baseline.
7. **Module boundaries:** the ESLint override and the static spec. Link to `security.md`.
8. **Frontend:**
   - the three layers with their support helpers (`fetchSequence`, a controller harness, `jasmine.clock`, `flushMicrotasks`, `elementTree` / `renderedOutput`);
   - the builders `buildRepository`, `buildSyncState`, `buildSource`;
   - the static "no `api.github.com`" spec.
9. **Cache:** the `cache-policy.coverage.spec.ts` additions; `navi/` is unchanged; the cache agent reviews.
10. **Where tests live:** each rule's tests are listed in the "Required tests" section of its owning file. `edge-cases.md` lists only cross-module scenario specs, all of type (b).

## Files to Change

- `docs/agents/specs/repos/testing.md` — new file.
