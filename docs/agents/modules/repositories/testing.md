# Repositories — Testing

Test tiers, default tier by category, GitHub mocking, and detached sync and time. Part of the [Repositories module](../repositories.md).

How the Repositories feature is tested: tiers, fakes, harnesses and the checks enforced by
tooling. Part of the Repositories module.

What to test lives in the "Required tests" section of each rule's owning file; this page says
**how**. No test of the feature calls the real GitHub, reads the wall clock or loops to catch a
race.

## Tiers

| Tier | Files | What it runs on |
|---|---|---|
| **Unit** | `*.spec.ts` | Services and helpers with injected fakes; no app boot. |
| **E2E with fakes** | `*.e2e-spec.ts` | The Nest app over HTTP, with the in-memory repository fake (`auth/tests/support/in-memory-repo.ts`) and the [GitHub fakes](#github-mocking). |
| **DB-backed** | `*.db-spec.ts` | A real MySQL 8 database, for the SQL semantics the fakes cannot prove ([below](#db-backed-tier)). |
| **Static** | `*.spec.ts` that scans sources | Source and metadata checks, no app boot and no database ([module boundaries](security.md#module-boundaries)). |
| **Frontend** | Jasmine specs under `frontend/specs/` | The client, controllers and rendering ([frontend](frontend.md)). |

### DB-backed tier

The in-memory fake cannot prove atomic claims, unique keys, transactions, compare-and-set,
conditional writes or `bigint` round trips, so a **narrow** tier runs them on real MySQL
(`mysql:8.4.11`, production's version):

- **Suffix:** `*.db-spec.ts`, excluded from the default `yarn test` run.
- **Runner:** a separate Jest config (`jest.db.config.ts`) and script, `yarn test:db`. It runs
  **serially**, on a dedicated test schema: the migrations run once per run, loaded from the
  TypeScript sources, and every table except `migrations` is truncated before each test.
- **Guard:** the tier refuses to start unless `KERGHAN_MYSQL_NAME` ends in `_test`, so it can
  never truncate dev or production data.
- **Locally:** through docker-compose, against the throwaway `kerghan_mysql_test` service, run
  through `kerghan_db_tests` (`make db-tests`). Never on the host.
- **CI:** its own job, `backend_db_tests`, with a `mysql:8.4.11` service container; the release
  and deploy jobs require it, like `backend_tests`.
- **Who added it:** #462 added the job, the script, the helpers and the docs (see
  [architecture/backend.md](../../architecture/backend.md#testing)).
- **Existing specs are unchanged:** the other modules keep their fakes, and the Integrations
  migration specs keep the fake query runner.

## Default tier by category

Each rule category has a **default tier**. An item in a "Required tests" section runs on its
category's default tier unless it carries an exception tag.

| Category | Default tier |
|---|---|
| Atomic sync claim (conditional `UPDATE`, affected-row count), first-use sync-state row with no duplicates, `run_id`-guarded writes, unique keys (`user_id` + `github_id`, `source_key` rows), per-page transactions (a later page fails, applied pages kept), the `secret_iv` compare-and-set (its call-flow logic is also unit-tested in #461; the DB-backed spec lands with #463), Add's conditional `added_at IS NULL` write, pruning / integration-deletion / `user.deleted` queries (with two users' rows), `github_id` above 2³¹ (`bigint`), the Repositories migrations up and down | **DB-backed** |
| Routes, DTOs, guards, cache headers, error mapping to HTTP answers | **E2E with fakes** |
| Service flow (sync orchestration, source handling, row statuses, handle reconciliation flow, Add flow) | **Unit**, or **E2E with fakes** when the HTTP answer is asserted |
| The Integrations GitHub client and `IntegrationsGithubService` (requests, headers, error mapping, budget tracker, token cache) | **Unit**, at the `fetch` level |
| Module boundaries, forbidden tokens, cache-policy coverage | **Static** |
| The Repositories page, its navbar link and the Account handle section | **Frontend** |

**Exception tags** go at the end of an item only when its tier would otherwise be misread: its
tier differs from its category's default, or it is a DB-backed, static or race item in a list
whose other items run on another tier (for example the concurrent Adds among `api.md`'s e2e
items). Untagged items run on their category's default tier.

| Tag | Meaning |
|---|---|
| `(db)` | Runs on the DB-backed tier. |
| `(e2e)` | Runs as an e2e spec with fakes. |
| `(unit)` | Runs as a unit spec. |
| `(static)` | A source-scanning or metadata spec. |
| `(race)` | A scripted-interleaving race spec, type (b) of [races](testing-coverage.md#concurrency-and-races). |

## GitHub mocking

Two layers, one per module. No test of the feature calls the real GitHub.

### Integrations: fetch level

The single GitHub client and `IntegrationsGithubService` are tested by spying on
`globalThis.fetch`, following `integrations/tests/github-client.service.spec.ts`. These specs
prove the request and its handling:

- the URL and parameters (`per_page=100&page=N`, `type=owner`, `sort=created`);
- `Authorization`, or no header at all for unauthenticated calls;
- `If-None-Match`;
- `redirect: 'manual'`;
- rate-limit header parsing and the budget tracker;
- installation-token minting and caching;
- the [error mapping](../integrations/github-service/status-and-errors.md#error-mapping) table.

### Repositories: typed fake

Every Repositories spec (unit, e2e and DB) injects a scriptable
**`FakeIntegrationsGithubService`**. It returns the exported typed results and never touches
`fetch`, since Repositories holds no HTTP code. It ships with the Integrations module's test
support (`integrations/tests/support/fake-integrations-github.service.ts`, #461), next to the
shared builders, so the fidelity contract spec guards it; Repositories imports it.

- **Integrations:** `setUsable(userId, refs)` sets what `listUsableIntegrations` answers and
  `setIntegrations(userId, refs)` what `listIntegrations` answers (by default, the usable list).
  Both are logged as non-GitHub calls.
- **Scripting:** answers are scripted per (`integrationId` or `null`, operation, page).
- **Call log:** every call is logged, so specs assert call counts and order, including "no
  GitHub call".
- **Deferred answers:** an answer can be held on a deferred promise, for
  [race specs](testing-coverage.md#concurrency-and-races).

### Shared builders

Typed test-support builders, no recorded JSON (`integrations/tests/support/github-builders.ts`):

- `githubRepo({ id, private, owner, name })`, with default ids above 2³¹;
- `listingPage(page, repos, { hasNext, etag })`;
- `repository(repo)` (a `GET /repositories/{id}` answer);
- `notModified()`, `rateLimited(resetAt)`, `unauthorized()`, `forbidden()`, `notFound()`,
  `timeout()`, `serverError()`, `redirect()`, `integrationUnusable(reason)`.

Integrations specs turn a builder into a raw GitHub response (body, `ETag`, `Link`,
`X-RateLimit-*` headers); the fake returns the matching typed result.

### Fake fidelity

An Integrations **contract spec** runs each builder case through the real service at the
`fetch` level and asserts that the typed result equals what the fake returns for the same
builder, so the fake cannot drift from the real service.

### No-network guard

The Repositories and Integrations GitHub test harnesses replace `globalThis.fetch`, before each
test, with a function that throws unless the spec mocks it
(`integrations/tests/support/no-network-guard.ts`). Other modules' specs are untouched.

## Detached sync and time

The rules are in [sync](sync/execution.md#execution) (`SyncLauncher`) and
[sync](sync/execution.md#time-source) (`Clock`, no `NOW()` in SQL).

**`CapturingLauncher`.** Tests replace the injected `SyncLauncher` with one that records tasks
without running them. A spec can then prove both halves of a trigger:

- the triggering request answered with the stored rows and the sync state, and the fake logged
  no GitHub call;
- after `await launcher.runAll()` (which runs the captured tasks and resolves once they
  settle), the run's effects are visible.

Race specs can also run a captured task step by step, together with the fake's deferred answers.

**`FakeClock`.** Tests replace the injected `Clock` (`core/clock.ts`) with the shared
`FakeClock` (`core/tests/support/fake-clock.ts`), exposing `set(date)` and `advance(ms)`, and
drive every time rule with it:

- the TTL, the Refresh cooldown, the lease and its heartbeat, the hard deadline;
- the `resetAt` of a `rate_limited` source and the budget tracker's reset window;
- the installation-token expiry minus 5 min;
- the Add rate-limit window.

Since no SQL time condition uses `NOW()`, the DB tier is driven by the same clock.

`jest.useFakeTimers` stays only for the per-call HTTP timeout in the Integrations `fetch`-level
specs, following the existing convention.

