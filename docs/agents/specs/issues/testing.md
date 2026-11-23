# Issues and Projects — Testing

Purpose: the test strategy of the feature (tiers, fixtures, how workers and security rules are tested).
Part of the [Issues and Projects specs](../issues.md). Same shape as the Repositories [testing section](../../modules/repositories/testing.md) (#451).

What to test lives in the "Required tests" section of each rule's owning file ([model.md](model.md#required-tests), [projects.md](projects.md#required-tests), [github-link.md](github-link.md#required-tests), [sync.md](sync.md#required-tests), [api.md](api.md#required-tests), [security.md](security.md#required-tests), [ui.md](ui.md#required-tests), [edge-cases.md](edge-cases.md#required-tests)); this page says **how**, and is never a second source of truth for **what**. No test of the feature calls the real GitHub, reads the wall clock or loops to catch a race.

## Tiers

The tiers are the Repositories ones; the DB-backed tier already exists and is not redefined here (`*.db-spec.ts`, `yarn test:db`, `make db-tests`, the `_test` schema guard: see [Repositories, DB-backed tier](../../modules/repositories/testing.md#db-backed-tier)).

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

- **GitHub fake.** The Issues module reaches GitHub only through `IntegrationsGithubService`. The issue operations `getIssue`, `updateIssue` and `probeIssues` ([sync.md](sync.md#github-issue-client-operations)) are added there by the implementation issues. The typed `FakeIntegrationsGithubService` is **extended** with the same operations: scripted answers per (integration, operation), including `not_modified` and the issue-specific kinds (`not_found`, `gone`, `moved`, `forbidden`), a **call log** (specs assert "no GitHub call", E8, E20, E24) and **deferred answers** (a promise the spec resolves) for race specs.
- **Builders.** Typed builders, no recorded JSON, beside the existing ones: `githubIssue({ id, number, title, body, state, updatedAt })`, `githubPullRequest(...)` (E3) and `issuePage(...)`. The error builders (`rateLimited`, `unauthorized`, `forbidden`, `notFound`, `timeout`, `serverError`) are reused. A deleted issue is a `notFound` plus a passing issues probe (E1, E22); a transferred one is a `moved` outcome (E2, E65); a failing probe is a `notFound` or `forbidden` on the probe read.
- **Redirect and `Location` contract spec (required).** A contract spec records GitHub's `200`, `404`, `410` and `301` answers for `/repos/{owner}/{name}/issues/{number}`, including the rename redirect and its `Location` form, and is runnable against live GitHub on demand; it is the fidelity contract for the link states of [github-link.md](github-link.md#gone-transferred-and-repository-unreachable) (E65). The `Location` of a transferred issue has not been observed yet and is still to be recorded; until then "any other target means moved" is an assumption.
- **Fidelity contract spec (required).** For each new operation, every builder case is run through the real `IntegrationsGithubService` at the `fetch` level (as [Repositories' GitHub mocking](../../modules/repositories/testing.md#github-mocking)) and its result must equal what the fake returns. The fake therefore cannot drift from the real client. The existing no-network guard covers the module: a test that reaches the real `fetch` fails.
- **`FakeClock`.** It drives both sides of the E7 rule: the marker's `updated_at` (passed from the injected `Clock`, never `NOW()`) and GitHub's `updated_at` set in the builders, plus the rate-limit reset of E17. Kerghan newer, GitHub newer and a tie are three clock settings. `FakeClock` and an injected scheduler also drive the rate-limit timer, the stale threshold and the 60-second fresh skip ([sync.md](sync.md#rate-limits)).
- **DB seed builders.** `seedProject`, `seedIssue`, `seedLink` and `seedMarker`. Every e2e and DB-backed harness also seeds an **intruder** user with rows of its own (a project, an issue, a link and a marker), as Repositories' two-user baseline.

## Worker tests

Built on the #479 infrastructure ([sync.md](sync.md)).

- **Thin jobs.** A job only calls an issues sync service with ids and maps the outcome to `_fail` or a clean finish. The logic is tested on the service with fakes; `perform()` is unit-tested directly.
- **`FakeWorkersService`.** It records `register` and `enqueue` (name and params) and runs the captured jobs on demand (`runAll()`), like Repositories' `CapturingLauncher`. Triggers are asserted without any engine, and every recorded job param is asserted to hold ids only.
- **Real-engine specs `(engine)`.** A small fixed set runs the **real** `WorkersService` and `deku-swarm`: registration by name, retry after `_fail`, and exhausted retries marking the link `sync_failed`, detected through the job's own attempt counter against the real `deku-swarm` with the issues retry config; a rate-limited job finishes without `_fail`. Each calls `resetDekuSwarm()` in `afterEach`, sets `cooldownMs` and `sleepMs` to 1 ms and uses deferreds instead of sleeping. Everything else uses the fake.
- **Restart (E14, E51) `(db)`.** Seed linked issues with markers; build a fresh module over the same database with a new `FakeWorkersService` (the old in-memory queue is gone); run the boot hook; assert each marker is enqueued exactly once, oldest first, and that a second job for the same link is a no-op. There is no real-engine restart variant. The same harness covers E16.

## Races

Both kinds assert invariants, never timing, and never loop to catch a race.

- **(a) True parallelism, DB tier `(db)`.** `Promise.all` on separate connections, asserting the invariant only. Cases: E34, E35, E42, E46, E48 and E49, and the bulk races E66 to E69 (a deletion, a project deletion, an attach and an overlapping call against a bulk call).
- **(b) Scripted interleaving `(race)`.** A deferred GitHub answer plus `FakeWorkersService`: pause the push, perform the competing action, release, assert. Cases: an edit during a push (E41, the marker revision changed so the job re-enqueues, and E10 for the refresh), unlink, project delete or user delete during a push (E44, E32), duplicate jobs (E13) and a crash before the clear (E15).

## Security verification

- **Canary sweep.** Seed canaries (a PAT, an OAuth token, a GitHub App key, an installation token, a GitHub error body); run every sync outcome (success, rate limit, E19 to E22, E24, exhausted retries) and every project, issue and link route, errors included; assert that no response body or header, no captured log line and no recorded job param contains one.
- **Job params.** An exact key allowlist of numeric ids, checked in the `FakeWorkersService` call log.
- **Route access matrix.** One table-driven e2e spec, `issues-routes.access-matrix.e2e-spec.ts`, over the routes (it replaced the three per-controller access specs): `401` without a session, `OriginGuard`, `X-Skip-Cache` and `no-store` on success, handler errors and validation errors, a malformed `projectId` or `issueId` answering `400`, no `GET` answered, the caller id taken from the session, no admin access (an `isAdmin` session is an ordinary user to the services), and a completeness check against the routes of every controller registered by the Issues module, read from its module metadata (a new route or controller without a row fails). The rows live in `support/registered-routes.ts` (`ROUTE_ROWS`) and are shared with the canary sweeps. They are the 19 routes of [api.md](api.md#every-route): `/projects/mine.json`, `create.json`, `from-repository.json`, and under `/projects/:projectId/` `show`, `edit`, `repository`, `delete`, `refresh`, `issues`, `issues/create`, `issues/import`, `issues/bulk-state`, and under `/issues/:issueId/` `show`, `edit`, `delete`, `attach`, `unlink`, `refresh`, `retry-sync`, all with the `.json` suffix. The `bulk-state` row (`/projects/:projectId/issues/bulk-state.json`, added by #563) carries the bulk weight boundary, which `issue-edit-rate-limiter.spec.ts` checks: `used + weight = max` passes, one more answers `429`, and a refused call consumes nothing.
  - The real-database 404 identity is `issues-routes.not-found.db-spec.ts`: every route with a path id answers a byte-identical body for another user's, a deleted and a missing project, for an issue of another user, of another project and a missing one, and for an admin session.
- **Two-user baseline** in every e2e and DB-backed harness (the intruder user above): `buildIssuesDbHarness`, `buildIssuesHttpDbHarness` and `buildIssuesCanaryHarness` seed the intruder (an approved user with an integration, a project, an issue, a link and a marker) before every test, through the `onTruncated` hook of the DB tier, and expose it as `harness.intruder`; counts of "what the call wrote" exclude his rows.
- **Canary harness.** `buildIssuesCanaryHarness` runs the real `IntegrationsGithubService`, `IntegrationsGithubIssueWriter`, installation-token cache and credential encryption with GitHub mocked at the `fetch` level (`ScriptedGithub`), mounts the request-logging chain, captures every log line and drains the real `issues.reconcile` job with its retries (`drainJobs()`). It adds no path by which Issues reads a credential: it wires the existing module boundary.
- **Edge-case coverage.** `edge-cases.coverage.spec.ts` `(static)` parses the E-ids of [edge-cases.md](edge-cases.md) and fails when no spec under `backend/src/` or `frontend/specs/` cites one, bar an allowlist that holds only E25 (the future "remove repository" feature). It reads `docs/` and `frontend/`, so it skips where only `backend/` is mounted (the dev `kerghan_tests` container) and runs in CI.
- **Static specs `(static)`.** The Issues sources contain no `fetch`, `secret_iv` or `NOW(`, map no Integrations or Auth table or entity, and their columns match an allowlist (the marker has no payload column). The cache-policy coverage spec gains the new controllers.
- **Content canary.** Next to the credential canary: a project name, description, issue title and body, and a repository owner/name carrying canary strings run through every route and the reconcile job, refusals and failures included; no log line contains any of them. A `4xx` refusal produces only the access line ([security.md](security.md#required-tests)).
- **Review checklist.** The `security` and `data-access` checklists of [security.md](security.md#review-checklist) are the review criteria of the implementation; each item maps to a Required test of [security.md](security.md#required-tests) or [api.md](api.md#required-tests). The mapping to the specs, as walked in #559, is [below](#review-checklist-to-spec-mapping).
- **Frontend static spec.** A project description and every title are rendered as text, never as markup; no `dangerouslySetInnerHTML` and no raw-HTML plugin in the Issues components; the frontend rendering unit specs of [security.md](security.md#required-tests) cover each row of the body rules.

### Review checklist to spec mapping

Every item of the [review checklist](security.md#review-checklist) and the spec that verifies it (paths under `backend/src/`; `issues/tests/` unless noted). Walked over the whole Issues module and its Integrations surface by #559; an item that had no test got one there.

`security` agent:

| # | Item | Spec and test |
|---|---|---|
| 1 | Guards, user-scoped cache, `POST` only, `X-Skip-Cache` | `issues-routes.access-matrix.e2e-spec.ts`: `declares every route user-scoped, with no @Public and no @AdminOnly, on a POST handler only` (added by #559), and the `401`, `403` (`OriginGuard`), no-store and `never answers GET` columns; `core/tests/cache-policy.coverage.spec.ts` |
| 2 | Only the writer sends a non-`GET`; `PATCH` allowlist; path from stored rows | `integrations/tests/integrations-writer-boundary.spec.ts` and `integrations-github-get-only.spec.ts` `(static)`; `integrations-github-issue-writer.service.spec.ts` (rejects other fields, `state_reason`); `github-issue-client.service.spec.ts` (`never sends state_reason, and never spreads its input`); `issues-sync.service.db-spec.ts` (`E55: never sends state_reason or an unchanged field`) |
| 3 | No automatic redirect; a `301` off `api.github.com` sends no credential | `integrations/tests/github-issue-redirect.spec.ts`, `github-issue-redirect.contract.spec.ts`, `github-issue-client.service.spec.ts` |
| 4 | Least-permission installation tokens, cached per permission set, never persisted | `integrations/tests/integrations-github.service.spec.ts` (`a repository listing token is not reused for an issue read (another permission set)`), `integrations-github-issue-writer.service.spec.ts` (`{"issues":"write"}` mint), `github-installation-token-cache.spec.ts` |
| 5 | No credential, content, URL, ETag or exception message in logs, job params, errors or `error.meta`; duplicate keys mapped | `issues-credential-canary.db-spec.ts` (credentials, ETags, GitHub's host, job params `{ linkId }`), `issues-content-canary.db-spec.ts` (titles, bodies, names, owner/name, a `4xx` leaves only the access line), `issues-unique-index.logging.db-spec.ts` (every unique index, sequentially and at once), `user-deleted.listener.db-spec.ts` (`E31 and E53`: safe fields only) |
| 6 | Restricted-Markdown rendering | Frontend: #560 to #562 (`frontend/specs/`) |
| 7 | DTO rules, `ParseUUIDPipe`, escaped `LIKE`, bound parameters | `issue-dtos.spec.ts`, `project-dtos.spec.ts`, `*.controller.validation.e2e-spec.ts`; the matrix's malformed `projectId` / `issueId` columns; `issues.service.listing.db-spec.ts` (`matches %j as a literal...`) and `projects.service.listing.db-spec.ts` (`searches a case-insensitive literal substring`); `sql-bound-parameters.spec.ts` `(static)` (added by #559) |
| 8 | Caps under the lock; both limiters before the access check; per-link job dedupe | `races/project-cap.race.db-spec.ts`, `races/issue-cap.race.db-spec.ts`; `issues.routes.db-spec.ts` (`answers 429 before the access check`) and `issue-links.rate-limit.db-spec.ts` (`answers 429 before the access check`); `issue-sync-queue.spec.ts` (`is a no-op while the same link is queued and not yet started`) |

`data-access` agent:

| # | Item | Spec and test |
|---|---|---|
| 1 | One access check, owner only; issues inside the path's project | `issues-access.spec.ts` and `issues-access.db-spec.ts`; `issues-routes.not-found.db-spec.ts` (the intruder on every route); the `*.routes.db-spec.ts` intruder cases |
| 2 | Foreign, deleted and missing answer the same `404`; project before issue | `issues-routes.not-found.db-spec.ts` (every route with a path id), `issues-access.db-spec.ts` (`answers the identical 404 Project not found...`) |
| 3 | No internal id, `user_id`, integration field or credential in a body or `error.meta` | `issues-routes.access-matrix.e2e-spec.ts` (`never leaks an internal id...`), `issues-credential-canary.db-spec.ts` (`carries no internal id, user id, integration field or deletion column in any body, error.meta included`, added by #559) |
| 4 | A repo ref resolves among the caller's own rows | `projects.service.repository.db-spec.ts` (`answers the Add 404 for a missing ref and another user's row`), `repositories/tests/repositories.service.project-lookups.db-spec.ts` |
| 5 | GitHub work uses the project owner's integrations; the link's `user_id` is for uniqueness | `issues-sync.service.db-spec.ts` (`uses the project owner, not the link user_id, for approval, candidates and every GitHub call`), `issue-links.refusals.db-spec.ts` (E57, E59) |
| 6 | Deleting a project or user removes everything; the tombstone is unreachable | `projects.service.delete.db-spec.ts` (`E33`, `E40`, `E49`), `user-deleted.listener.db-spec.ts` (`E31`) |
| 7 | Admins have no access | `issues-routes.access-matrix.e2e-spec.ts` (the admin column), `issues-routes.not-found.db-spec.ts` (`an admin session gets the same 404...`) |

## Frontend tests

Jasmine, under `frontend/specs/`, in three layers as for Repositories: the **client** (requests and error mapping against a fake transport), the **controllers** (state, retry and unlink actions, the deletion confirmation) and the **render** layer. Fixtures are typed builders for projects, issues and link states, with no recorded JSON. Required: the project list and issue list; the link and sync state views ("GitHub issue gone", "rate limited until X", sync failed with a distinct credential reason: E1, E2, E17, E19 to E21); the retry sync and unlink actions (E18); the deletion confirmation (a general warning with the typed project name; the count of issues with unsent changes is shown after the delete); the open-issue count on project rows and the bulk bar, selection and summary notice of [ui/states.md](ui/states.md) (built and tested in #563, against the response shape of [api/issues.md](api/issues.md#bulk-close-and-reopen)); plus the routes, linking modals, bounded re-reads, `ConfirmModal` and the U rows. The full list is the Required tests of [ui.md](ui.md#required-tests).

## Coverage per area

| Area | Main tiers | Fixtures | Owning "Required tests" | Edge cases |
|---|---|---|---|---|
| Model | DB-backed | seed builders, intruder user, restart harness | [model.md](model.md#required-tests) | E4, E12, E14, E16, E41 to E56 |
| Projects | E2E with fakes; `(db)` concurrency | seed builders, in-memory fakes, fake GitHub (call log) | [projects.md](projects.md#required-tests) | E25 to E29, E33 to E40, E73 |
| Link | Unit (E57 to E61, E65); E2E with fakes (E62 to E64); `(db)` (E62 race); `(race)` (E1 edit against `gone`) | `FakeIntegrationsGithubService`, `githubIssue`, `githubPullRequest`, error builders | [github-link.md](github-link.md#required-tests) | E1 to E5, E22, E57 to E65 |
| Sync (reconcile table, rate-limit waiting set and timer, integration fallback, staleness) | Unit; `(engine)`; `(race)`; `(db)` restart | fake GitHub, `FakeClock`, `FakeWorkersService`, deferreds | [sync.md](sync.md#required-tests) | E6 to E11, E13 to E21, E23, E24 |
| API | E2E with fakes | in-memory fakes, intruder user | [api.md](api.md#required-tests) | E34 to E40 (status mapping), E66 to E74 (count and bulk) |
| Security | E2E; Static; Unit | canaries, route matrix, call log, log capture | [security.md](security.md#required-tests) | E19 to E22, E24, E31, E53 |
| UI | Frontend | typed builders | [ui.md](ui.md#required-tests) | E1, E2, E17 to E21, E33 |

## Open questions

- [x] How GitHub-sourced content is rendered: decided in [security.md](security.md#github-and-user-content) (#490); the frontend static spec extends to it.
- [x] Screens and wording the frontend specs follow: decided in [ui.md](ui.md) (#491).

## Required tests

The checks of the testing infrastructure itself:

- The **fidelity contract**: every builder case of each new GitHub operation, run through the real service at the `fetch` level, equals the fake's answer.
- The **no-network guard** fails a test of the module that reaches the real `fetch`.
- The **access matrix** is complete against the registered routes.
- The **API cases** of [api.md](api.md#required-tests) run in the e2e tier, including the attach stale confirmation within the same second (`datetime(3)`, with `FakeClock`) and the code-point length case (a 4-byte character counts once).
- The **static specs** pass: forbidden tokens, no Integrations or Auth mapping, the column allowlist and cache-policy coverage.
- **Job params** hold only the allowed numeric ids, and the **canary sweep** finds no credential, and the **content canary** no title, body, name or owner/name, in any response, header, log line or job param.
- The **real-engine specs** (registration by name, retry after `_fail`, exhaustion marking `sync_failed` detected through the job's own attempt counter, a rate-limited job finishing without `_fail`) run on the real engine with the issues retry config (`maxRetries` from `KERGHAN_ISSUES_SYNC_MAX_RETRIES`, cooldown 1 ms).
- The **restart spec** re-enqueues every marker once, oldest first, over a fresh module on the same database.
