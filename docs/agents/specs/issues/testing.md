# Issues and Projects — Testing

Purpose: the test strategy of the feature (tiers, fixtures, how workers and security rules are tested).
Part of the [Issues and Projects specs](../issues.md). Same shape as the Repositories [testing section](../../modules/repositories.md#testing) (#451).

What to test lives in the "Required tests" section of each rule's owning file ([model.md](model.md#required-tests), [projects.md](projects.md#required-tests), [github-link.md](github-link.md#required-tests), [sync.md](sync.md#required-tests), [api.md](api.md#required-tests), [security.md](security.md#required-tests), [ui.md](ui.md#required-tests), [edge-cases.md](edge-cases.md#required-tests)); this page says **how**, and is never a second source of truth for **what**. No test of the feature calls the real GitHub, reads the wall clock or loops to catch a race.

## Tiers

The tiers are the Repositories ones; the DB-backed tier already exists and is not redefined here (`*.db-spec.ts`, `yarn test:db`, `make db-tests`, the `_test` schema guard: see [Repositories, DB-backed tier](../../modules/repositories.md#db-backed-tier)).

| Tier | Files | What it runs on |
|---|---|---|
| **Unit** | `*.spec.ts` | Sync services, jobs and helpers with injected fakes; no app boot. |
| **E2E with fakes** | `*.e2e-spec.ts` | The Nest app over HTTP, with the in-memory fakes, `FakeIntegrationsGithubService` and `FakeWorkersService`. |
| **DB-backed** | `*.db-spec.ts` | A real MySQL 8 database, for the SQL semantics the fakes cannot prove. |
| **Static** | `*.spec.ts` that scans sources | Source and metadata checks; no boot, no database. |
| **Frontend** | Jasmine specs under `frontend/specs/` | The client, controllers and rendering. |

### Default tier by category

An item of a "Required tests" list runs on its category's default tier unless it carries an exception tag.

| Category | Default tier |
|---|---|
| Unique keys, compare-and-clear, the marker upsert in the edit transaction, `deleted_token`, `user.deleted` and project cleanup queries (with two users' rows), boot re-enqueue, utf8mb4, `bigint`, migrations up and down | **DB-backed** |
| Routes, DTOs, guards, cache headers, `404`/`200`/`201`/`409` mapping | **E2E with fakes** |
| Sync service flow (conflicts E6 to E11, rate limit E17, retry and exhaustion E18, credential outcomes E19 to E21, non-approved E24, Unavailable gating) and job `perform()` | **Unit** |
| Registration by name, retry after `_fail`, exhaustion marking `sync_failed` | **Unit with the real engine** `(engine)` |
| Module boundaries, forbidden tokens, column allowlists, cache-policy coverage | **Static** |
| Project list, issue list, link and sync state views, deletion confirmation, retry and unlink actions | **Frontend** |

**Exception tags** go at the end of an item only when its tier would otherwise be misread: its tier differs from its category's default, or it is a DB-backed, static, race or engine item in a list whose other items run elsewhere. Untagged items run on their category's default tier.

| Tag | Meaning |
|---|---|
| `(db)` | Runs on the DB-backed tier. |
| `(e2e)` | Runs as an e2e spec with fakes. |
| `(unit)` | Runs as a unit spec. |
| `(static)` | A source-scanning or metadata spec. |
| `(race)` | A scripted-interleaving race spec, type (b) of [races](#races). |
| `(engine)` | Runs the real `WorkersService` and `deku-swarm`, see [worker tests](#worker-tests). |

## Fixtures

- **GitHub fake.** The Issues module reaches GitHub only through `IntegrationsGithubService`. The issue operations (read, list, create, update) are added there by the implementation issues; their names and payloads come from #488, so this page fixes the fake's shape and contract, not method names. The typed `FakeIntegrationsGithubService` is **extended** with the same operations: scripted answers per (integration, operation), a **call log** (specs assert "no GitHub call", E8, E20, E24) and **deferred answers** (a promise the spec resolves) for race specs.
- **Builders.** Typed builders, no recorded JSON, beside the existing ones: `githubIssue({ id, number, title, body, state, updatedAt })`, `githubPullRequest(...)` (E3) and `issuePage(...)`. The error builders (`rateLimited`, `unauthorized`, `forbidden`, `notFound`, `timeout`, `serverError`) are reused. A deleted issue is a `notFound` plus a passing issues probe (E1, E22); a transferred one is a `moved` outcome (E2, E65); a failing probe is a `notFound` or `forbidden` on the probe read.
- **Redirect and `Location` contract spec (required).** A contract spec records GitHub's `200`, `404`, `410` and `301` answers for `/repos/{owner}/{name}/issues/{number}`, including the rename redirect and its `Location` form, and is runnable against live GitHub on demand; it is the fidelity contract for the link states of [github-link.md](github-link.md#gone-transferred-and-repository-unreachable) (E65). The `Location` of a transferred issue has not been observed yet and is still to be recorded; until then "any other target means moved" is an assumption.
- **Fidelity contract spec (required).** For each new operation, every builder case is run through the real `IntegrationsGithubService` at the `fetch` level (as [Repositories' GitHub mocking](../../modules/repositories.md#github-mocking)) and its result must equal what the fake returns. The fake therefore cannot drift from the real client. The existing no-network guard covers the module: a test that reaches the real `fetch` fails.
- **`FakeClock`.** It drives both sides of the E7 rule: the marker's `updated_at` (passed from the injected `Clock`, never `NOW()`) and GitHub's `updated_at` set in the builders, plus the rate-limit reset of E17. Kerghan newer, GitHub newer and a tie are three clock settings.
- **DB seed builders.** `seedProject`, `seedIssue`, `seedLink` and `seedMarker`. Every e2e and DB-backed harness also seeds an **intruder** user with rows of its own (a project, an issue, a link and a marker), as Repositories' two-user baseline.

## Worker tests

Built on the #479 infrastructure ([sync.md](sync.md)).

- **Thin jobs.** A job only calls an issues sync service with ids and maps the outcome to `_fail` or a clean finish. The logic is tested on the service with fakes; `perform()` is unit-tested directly.
- **`FakeWorkersService`.** It records `register` and `enqueue` (name and params) and runs the captured jobs on demand (`runAll()`), like Repositories' `CapturingLauncher`. Triggers are asserted without any engine, and every recorded job param is asserted to hold ids only.
- **Real-engine specs `(engine)`.** A small fixed set runs the **real** `WorkersService` and `deku-swarm`: registration by name, retry after `_fail`, and exhausted retries marking the link `sync_failed`. Each calls `resetDekuSwarm()` in `afterEach`, sets `cooldownMs` and `sleepMs` to 1 ms and uses deferreds instead of sleeping. Everything else uses the fake.
- **Restart (E14, E51) `(db)`.** Seed linked issues with markers; build a fresh module over the same database with a new `FakeWorkersService` (the old in-memory queue is gone); run the boot hook; assert each marker is enqueued exactly once, oldest first, and that a second job for the same link is a no-op. There is no real-engine restart variant. The same harness covers E16.

## Races

Both kinds assert invariants, never timing, and never loop to catch a race.

- **(a) True parallelism, DB tier `(db)`.** `Promise.all` on separate connections, asserting the invariant only. Cases: E34, E35, E42, E46, E48 and E49.
- **(b) Scripted interleaving `(race)`.** A deferred GitHub answer plus `FakeWorkersService`: pause the push, perform the competing action, release, assert. Cases: an edit during a push (E41, the marker revision changed so the job re-enqueues, and E10 for the refresh), unlink, project delete or user delete during a push (E44, E32), duplicate jobs (E13) and a crash before the clear (E15).

## Security verification

- **Canary sweep.** Seed canaries (a PAT, an OAuth token, a GitHub App key, an installation token, a GitHub error body); run every sync outcome (success, rate limit, E19 to E22, E24, exhausted retries) and every project, issue and link route, errors included; assert that no response body or header, no captured log line and no recorded job param contains one.
- **Job params.** An exact key allowlist of numeric ids, checked in the `FakeWorkersService` call log.
- **Route access matrix.** One table-driven e2e spec over the routes: `401` without a session, `OriginGuard`, `X-Skip-Cache`, a foreign or deleted project answering a body identical to a missing one, no admin access, and a completeness check against the registered routes (a new route without a row fails).
- **Two-user baseline** in every e2e and DB-backed harness (the intruder user above).
- **Static specs `(static)`.** The Issues sources contain no `fetch`, `secret_iv` or `NOW(`, map no Integrations or Auth table or entity, and their columns match an allowlist (the marker has no payload column). The cache-policy coverage spec gains the new controllers.
- **Frontend static spec.** A project description is rendered as text, never as markup. How GitHub-sourced content is rendered stays with #490.

## Frontend tests

Jasmine, under `frontend/specs/`, in three layers as for Repositories: the **client** (requests and error mapping against a fake transport), the **controllers** (state, retry and unlink actions, the deletion confirmation) and the **render** layer. Fixtures are typed builders for projects, issues and link states, with no recorded JSON. Required: the project list and issue list; the link and sync state views ("GitHub issue gone", "rate limited until X", sync failed with a distinct credential reason: E1, E2, E17, E19 to E21); the retry sync and unlink actions (E18); the deletion confirmation, with its count of issues with unsent changes. Screens and wording are #491's; the specs follow them once decided.

## Coverage per area

| Area | Main tiers | Fixtures | Owning "Required tests" | Edge cases |
|---|---|---|---|---|
| Model | DB-backed | seed builders, intruder user, restart harness | [model.md](model.md#required-tests) | E4, E12, E14, E16, E41 to E56 |
| Projects | E2E with fakes; `(db)` concurrency | seed builders, in-memory fakes, fake GitHub (call log) | [projects.md](projects.md#required-tests) | E25 to E29, E33 to E40 |
| Link | Unit (E57 to E61, E65); E2E with fakes (E62 to E64); `(db)` (E62 race); `(race)` (E1 edit against `gone`) | `FakeIntegrationsGithubService`, `githubIssue`, `githubPullRequest`, error builders | [github-link.md](github-link.md#required-tests) | E1 to E5, E22, E57 to E65 |
| Sync | Unit; `(engine)`; `(race)`; `(db)` restart | fake GitHub, `FakeClock`, `FakeWorkersService`, deferreds | [sync.md](sync.md#required-tests) | E6 to E11, E13 to E21, E23, E24 |
| API | E2E with fakes | in-memory fakes, intruder user | [api.md](api.md#required-tests) | E34 to E40 (status mapping) |
| Security | E2E; Static; Unit | canaries, route matrix, call log, log capture | [security.md](security.md#required-tests) | E19 to E22, E24, E31, E53 |
| UI | Frontend | typed builders | [ui.md](ui.md#required-tests) | E1, E2, E17 to E21, E33 |

## Open questions

- [ ] The exact operation names and payloads of the GitHub issue client, which the fake and the contract spec mirror. (#488)
- [ ] How GitHub-sourced content is rendered, which the frontend static spec extends to. (#490)
- [ ] Screens and wording the frontend specs follow. (#491)

## Required tests

The checks of the testing infrastructure itself:

- The **fidelity contract**: every builder case of each new GitHub operation, run through the real service at the `fetch` level, equals the fake's answer.
- The **no-network guard** fails a test of the module that reaches the real `fetch`.
- The **access matrix** is complete against the registered routes.
- The **static specs** pass: forbidden tokens, no Integrations or Auth mapping, the column allowlist and cache-policy coverage.
- **Job params** hold only the allowed numeric ids, and the **canary sweep** finds no credential in any response, header, log line or job param.
- The **real-engine specs** (registration by name, retry after `_fail`, exhaustion marking `sync_failed`) run on the real engine with a 1 ms cooldown.
- The **restart spec** re-enqueues every marker once, oldest first, over a fresh module on the same database.
