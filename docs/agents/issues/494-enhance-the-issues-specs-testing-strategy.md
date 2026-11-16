## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is first defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`). This issue is documentation only: no code, migrations or endpoints.

Write `docs/agents/specs/issues/testing.md`, the test strategy of the feature, in the shape of the Repositories testing section ([modules/repositories.md](../modules/repositories.md#testing), #451). The first version of the specs (#484) added the file with five open questions; this issue resolves them and fills the gaps.

## Problem

`testing.md` is a stub ("No strategy decided yet"). Every other spec file lists "Required tests", but none says **how** they run: which tier, against what fake, how a worker or a restart is exercised, or how "no credential in any response, job param or log" is proven. Without that, each implementation issue would invent its own fixtures, and the edge-cases matrix ([edge-cases.md](../specs/issues/edge-cases.md)) leaves its fixtures "owned by #494".

## Expected Behavior

- `testing.md` fixes the tiers, the fixtures, the worker and restart tests, the coverage per area and the security verification, precisely enough for implementation issues to build against.
- Every "Required tests" item of the other spec files has a clear tier (its category's default, or an exception tag).
- The related spec files are consistent with it, and no #494 open question remains unresolved.

## Solution

Documentation only. `testing.md` says **how** to test; **what** to test stays in each file's "Required tests".

### Approach

Mirror the Repositories testing section: tiers, a default tier per rule category, exception tags, fixtures, workers, races, security verification, frontend tests and a per-area coverage map. No test calls the real GitHub, reads the wall clock or loops to catch a race.

### Tiers and default tier per category

Tiers as Repositories: Unit, E2E with fakes, DB-backed, Static and Frontend. Tags go at the end of an item only when its tier would otherwise be misread: `(db)`, `(e2e)`, `(unit)`, `(static)`, `(race)`, plus `(engine)` for the few specs that run the real `WorkersService`.

| Category | Default tier |
|---|---|
| Unique keys, compare-and-clear, the marker upsert in the edit transaction, `deleted_token`, `user.deleted` and project cleanup queries (with two users' rows), boot re-enqueue, utf8mb4, `bigint`, migrations up and down | DB-backed |
| Routes, DTOs, guards, cache headers, `404`/`200`/`201`/`409` mapping | E2E with fakes |
| Sync service flow (conflicts E6 to E11, rate limit E17, retry and exhaustion E18, credential outcomes E19 to E21, non-approved E24, Unavailable gating) and job `perform()` | Unit |
| Registration by name, retry after `_fail`, exhaustion marking `sync_failed` | Unit with the real engine `(engine)` |
| Module boundaries, forbidden tokens, column allowlists, cache-policy coverage | Static |
| Project list, issue list, link and sync state views, deletion confirmation, retry and unlink actions | Frontend |

### Fixtures

- The Issues module reaches GitHub only through `IntegrationsGithubService`. The issue operations (read, list, create, update) are added there by the implementation issues (names and payloads come from #487 and #488). The typed `FakeIntegrationsGithubService` is **extended** with the same operations: scripted answers per (integration, operation), a call log (specs assert "no GitHub call") and deferred answers for race specs.
- Typed builders, no recorded JSON, beside the existing ones: `githubIssue({ id, number, title, body, state, updatedAt })`, `githubPullRequest(...)` (E3) and `issuePage(...)`. The error builders (`rateLimited`, `unauthorized`, `forbidden`, `notFound`, `timeout`, `serverError`) are reused; a deleted or transferred issue is a `notFound` plus a readable repository (E1, E2, E22).
- The Integrations **contract spec is required** for the new operations: each new builder case is run through the real service at the `fetch` level and must equal what the fake returns. The existing no-network guard covers the module.
- `FakeClock` drives both sides of the E7 conflict rule (the marker's `updated_at`, passed from the `Clock`, never `NOW()`, and the GitHub `updated_at` set in the builders) and the rate-limit reset (E17).
- DB seed builders `seedProject`, `seedIssue`, `seedLink` and `seedMarker`. Every e2e and DB-backed harness also seeds an **intruder** user with rows of its own, like Repositories' two-user baseline.

### Worker tests (#479 infrastructure)

- Job classes stay thin: a job only calls an issues sync service with ids and maps the outcome to `_fail` or a clean finish. Logic is tested on the service with fakes; `perform()` is unit-tested directly.
- A `FakeWorkersService` records `register` and `enqueue` (name and params) and runs the captured jobs on demand (`runAll()`), like Repositories' `CapturingLauncher`. Triggers are asserted without any engine, and job params are asserted to hold ids only.
- A small fixed set of specs runs the **real** `WorkersService` and `deku-swarm` (`resetDekuSwarm()` in `afterEach`, `cooldownMs` and `sleepMs` at 1 ms, deferreds instead of sleeping): registration by name, retry after `_fail`, and exhausted retries marking the link `sync_failed`. Everything else uses the fake.
- **Restart** is DB-backed: seed linked issues with markers, build a fresh module over the same database with a new `FakeWorkersService` (the old in-memory queue is gone), run the boot hook, and assert each marker is enqueued exactly once, oldest first, and that a second job for the same link is a no-op (E14, E51). No real-engine restart variant.

### Races

- **(a) True parallelism, DB tier:** `Promise.all` on separate connections, asserting invariants only, no repeat loops. Cases: E34, E35, E42, E46, E48 and E49.
- **(b) Scripted interleaving, tag `(race)`:** a deferred GitHub answer plus `FakeWorkersService`; pause the push, perform the competing action, release, assert. Cases: an edit during a push (E41, the marker revision changed so the job re-enqueues), unlink or project or user delete during a push (E44, E32) and duplicate jobs (E15).

### Security verification

- **Canary sweep:** seed canaries (a PAT, an OAuth token, a GitHub App key, an installation token, a GitHub error body); run every sync outcome (success, rate limit, E19 to E22, E24, exhausted retries) and every project, issue and link route including errors; assert that no response body or header, no captured log line and no recorded job param contains one.
- **Job params:** an exact key allowlist of numeric ids, checked in the `FakeWorkersService` log.
- **Route access matrix:** one table-driven e2e spec over the routes (`401` without a session, `OriginGuard`, `X-Skip-Cache`, a foreign or deleted project answering a body identical to a missing one, no admin access, completeness against the registered routes).
- **Two-user baseline** in every e2e and DB harness.
- **Static specs:** the Issues sources contain no `fetch`, `secret_iv` or `NOW(`, map no Integrations or Auth table or entity, and their columns match an allowlist (the marker has no payload column). The cache-policy coverage spec gains the new controllers.
- **Frontend static spec:** a project description is rendered as text, never as markup. How GitHub-sourced content is rendered stays with #490.

### Coverage per area

One table (model, projects, link, sync, API, security, UI) with the main tiers, the fixtures, the owning file's "Required tests" and the edge-case ids E1 to E56.

### Consistency edits (same PR as `testing.md`)

- `edge-cases.md`: replace "fixtures owned by #494" with a link to `testing.md`, and map each E-row to a tier.
- `sync.md`, `security.md`, `api.md`, `ui.md`, `github-link.md`, `projects.md`: resolve their #494 mentions, and add a tag to an item only where its tier would be misread.
- `model.md` and the `issues.md` index: cross-link the DB-backed required tests and update the index row if needed.

### Scope, alternatives, compatibility, performance and security

- **In scope:** `testing.md` and the consistency edits above.
- **Out of scope:** any code, test, migration or endpoint; the fake's and the builders' implementation (spawned by #492); the issue operations of `IntegrationsGithubService` (#487, #488); route lists (#489); GitHub-content rendering and the threat review (#490); screens (#491).
- **Alternatives rejected:** a lighter strategy (tiers, fixtures and a table only) leaves races and security checks to each implementation issue; fake-only workers would leave retry, cooldown and exhaustion untested against the real engine; the real engine in every sync spec would be slow and timing-sensitive.
- **Compatibility:** the Repositories test support is reused and extended, never changed in behavior; no existing spec changes.
- **Performance:** the DB-backed tier stays narrow and serial, and the real-engine specs are few and use a 1 ms cooldown with deferreds, so the default suite stays fast.
- **Security:** nothing is stored or sent; the strategy itself is what proves that no credential reaches a response, a job param or a log.

## Benefits

- Implementation issues build against one agreed set of tiers, fixtures and checks.
- Concurrency, restart and security rules are tested deterministically, not by repeating runs or sleeping.
- The fake GitHub client cannot drift from the real one.

## Acceptance criteria

- `testing.md` has no unresolved open questions, or lists the remaining ones with the reason and the issue that will settle them.
- It covers tiers, fixtures, worker and restart tests, races, security verification and the coverage per area, with a "Required tests" section.
- Related spec files are consistent with it (edge-cases, sync, security, api, ui, github-link, projects, model and the index).
- No code, migrations or endpoints are added.

## Notes

Responsible agent: `architect`. Same shape as the repositories testing spec (#451). It comes after the edge-cases matrix (#493), since the matrix feeds the strategy.
