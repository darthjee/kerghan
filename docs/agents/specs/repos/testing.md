# Repositories — Testing strategy

How the Repositories feature is tested: tiers, fakes, harnesses and the checks enforced by
tooling. Part of the [Repositories specs](README.md).

What to test lives in the "Required tests" section of each rule's owning file; this page says
**how**. No test of the feature calls the real GitHub, reads the wall clock or loops to catch a
race.

## Tiers

| Tier | Files | What it runs on |
|---|---|---|
| **Unit** | `*.spec.ts` | Services and helpers with injected fakes; no app boot. |
| **E2E with fakes** | `*.e2e-spec.ts` | The Nest app over HTTP, with the in-memory repository fake (`auth/tests/support/in-memory-repo.ts`) and the [GitHub fakes](#github-mocking). |
| **DB-backed** | `*.db-spec.ts` | A real MySQL 8 database, for the SQL semantics the fakes cannot prove ([below](#db-backed-tier)). |
| **Static** | `*.spec.ts` that scans sources | Source and metadata checks, no app boot and no database ([module boundaries](#module-boundaries)). |
| **Frontend** | Jasmine specs under `frontend/specs/` | The client, controllers and rendering ([frontend](#frontend)). |

### DB-backed tier

The in-memory fake cannot prove atomic claims, unique keys, transactions, compare-and-set,
conditional writes or `bigint` round trips, so a **narrow** tier runs them on real MySQL 8:

- **Suffix:** `*.db-spec.ts`, excluded from the default `yarn test` run.
- **Runner:** a separate Jest config and script, `yarn test:db`. It runs **serially**, on a
  dedicated test schema: the migrations run once per run, and the Repositories tables are
  truncated before each test.
- **Locally:** through docker-compose, against the existing MySQL service. Never on the host.
- **CI:** its own job with a `cimg/mysql:8.0` service container; the release and deploy jobs
  require it, like `backend_tests`.
- **Who adds it:** the first implementation sub-issue that needs it adds the job, the script and
  the docs, following [architecture/backend.md](../../architecture/backend.md#testing) ("add a
  `cimg/mysql` service … when the first spec actually needs a real database"). None of it exists
  yet.
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
| `(race)` | A scripted-interleaving race spec, type (b) of [races](#concurrency-and-races). |

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
- the [error mapping](integrations.md#error-mapping) table.

### Repositories: typed fake

Every Repositories spec (unit, e2e and DB) injects a scriptable
**`FakeIntegrationsGithubService`**. It returns the exported typed results and never touches
`fetch`, since Repositories holds no HTTP code. It ships with the Integrations module's test
support (`integrations/tests/support/fake-integrations-github.service.ts`, #461), next to the
shared builders, so the fidelity contract spec guards it; Repositories imports it.

- **Scripting:** answers are scripted per (`integrationId` or `null`, operation, page).
- **Call log:** every call is logged, so specs assert call counts and order, including "no
  GitHub call".
- **Deferred answers:** an answer can be held on a deferred promise, for
  [race specs](#concurrency-and-races).

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

The rules are in [sync.md](sync.md#execution) (`SyncLauncher`) and
[sync.md](sync.md#time-source) (`Clock`, no `NOW()` in SQL).

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

## Concurrency and races

Two kinds of race test. Production code gets **no test-only hooks**.

**(a) True parallelism, on the DB tier.**

- Cases: the atomic claim (two triggers start exactly one sync; the claim is refused inside the
  cooldown or while another run holds an unexpired lease); first-use creation of the sync-state
  row; concurrent handle reconciliation, which happens once; a double Add, which writes once and
  answers `200` twice.
- Each fires N operations at once with `Promise.all` on separate pool connections, then asserts
  the **invariants**: exactly one claim, one row, one write, and the expected answers. Invariants
  do not depend on which interleaving happened, so they do not flake.
- No repeat loops.

**(b) Scripted interleaving, deterministic (tag `(race)`).**

- The only pause points are GitHub calls (a deferred answer of `FakeIntegrationsGithubService`)
  and the `CapturingLauncher`.
- A spec pauses the run at a GitHub call, performs the competing action, releases the answer,
  then asserts.
- Competing actions:
  - delete the integration;
  - replace its credential (the `secret_iv` compare-and-set);
  - change the handle;
  - Add the repo;
  - delete the user;
  - advance the `FakeClock` past the lease and start run B (zombie writes, lock release by
    `run_id`);
  - pass the hard deadline.
- "A page written after the deletion hook's cleanup" is the paused page answer released after
  the deletion: that is how the end-of-sync safety net is tested.

**Integrations-level races** (installation-token single-flight, concurrent budget acquires never
overshooting) use deferred `fetch` replies in the `fetch`-level specs.

The cross-module scenarios of [edge-cases.md](edge-cases.md#required-tests) are type (b) specs.

## Access control and leaks

### Route access matrix

One **table-driven e2e spec**, following `integrations/tests/integrations.controller.access.e2e-spec.ts`.

- **Routes:** the four Repositories routes, `POST /auth/account/mine.json`, and the handle path of
  `PATCH /auth/account.json`.
- **Rules checked on every row:**
  - `401 UNAUTHORIZED` without a session;
  - rejected by `OriginGuard` from a foreign origin;
  - `X-Skip-Cache` is sent;
  - for repo-ref routes, a foreign repo answers a body identical to a missing one (timestamp
    ignored);
  - an admin session gets no access to another user's repositories;
  - `/admin/users/*` carries no repository-derived field and no `githubHandle`.
- **Completeness:** the spec compares its table with the controllers' registered routes, read
  from Nest metadata; a Repositories route missing from the table fails the spec.

### Credential canary sweep

Reuses the existing `CANARY_*` pattern of the Integrations specs.

- **Canaries seeded:** a PAT, an OAuth token, a GitHub App private key, a minted installation
  token, and a GitHub error body/message.
- **Flow exercised:** a sync with every source status; the listing and the sync state; Add's
  success and every Add error (`404`, `409`, `429`, `502`, `503`).
- **Assertion:** no response body, response header or captured log line contains any canary.
- The `fetch`-level Integrations specs also assert that `Authorization` is never sent off
  `https://api.github.com` and that installation tokens are minted with `metadata: read` only.

### Two-user baseline

Every Repositories e2e and DB harness seeds an **intruder** user holding a row with the same
`github_id` and an integration of its own. Every spec can therefore assert that the intruder's
rows are untouched and never returned, on top of the dedicated scoping specs.

## Module boundaries

The rules are in [security.md](security.md#module-boundaries). Both checks are added by the first
implementation sub-issue that needs them.

- **ESLint override** on `backend/src/repositories/**`: `no-restricted-imports` allows
  Integrations and Auth only through their exported entry points (`IntegrationsGithubService` and
  its typed results, `AccountHandleService`, the `integration.deleted` / `user.deleted` event
  types) and refuses their entities, the encryption service and the GitHub client;
  `no-restricted-globals` bans `fetch`.
- **Static Jest spec** (`*.spec.ts`, in the style of `core/tests/cache-policy.coverage.spec.ts`;
  no app boot, no database):
  - scans the `repositories/**` sources, tests excluded, for the forbidden tokens: the
    `auth_users` and `integrations` table names in query strings or `@Entity` mappings,
    `secret_iv`, and `NOW(` / `CURRENT_TIMESTAMP`;
  - asserts that no Repositories entity maps an `auth_users` or `integrations` table;
  - asserts that the exported `IntegrationsGithubService` result types carry no credential
    field, against a fixed allowlist of each result's keys.
- **Review still applies:** the security and data-access agents review every implementation PR;
  the tooling catches regressions between reviews.

## Frontend

Jasmine specs in the house style of the Integrations page, in three layers. Each spec file
mirrors its source under `frontend/specs/assets/js/`.

1. **Client spec** (`RepositoriesClient`), with `specs/support/fetchSequence.js`:
   - every route's method (`POST`), URL and body, all targeting Kerghan's API base;
   - the mapping of error answers to `ApiError`, including `error.retryAfterSeconds`;
   - the `AccountsClient` additions (`POST /auth/account/mine.json`, the handle-only `PATCH`).
2. **Controller specs**, with a harness like `specs/support/integrationsControllerHarness.js`: a
   fixed `NOW`, state-setter spies, `jasmine.clock()` and `flushMicrotasks`. They cover polling
   and when it stops, the Refresh countdown and its `429` adoption, Add state kept by `githubId`
   across a reload, banner dismissal, the empty-page jump, frozen rows while syncing, the Added
   row under the "Not added" filter, and the Account handle section's load, save and validation
   flow.
3. **Render specs**, with `elementTree` / `renderedOutput`: texts and links (the
   `https://github.com/<owner>/<name>` URL-encoding, the Integrations and Account links), muted
   badges and tooltips, banners per status, the empty states and the no-match message, the
   spinner vs the syncing indicator, the navbar link, the handle section, and no handle on the
   admin user pages.

- **Builders:** `buildRepository`, `buildSyncState` and `buildSource` in `specs/support/` mirror
  [api.md](api.md)'s response shapes; specs override only the fields they test.
- **Static "no `api.github.com`" spec:** frontend sources never contain `api.github.com`. Repo
  links point to `github.com` web URLs only and are rendered as links, never fetched.

## Cache

- **`core/tests/cache-policy.coverage.spec.ts`** gains `RepositoriesController` (and the
  controller of `POST /auth/account/mine.json`, if new) in `KNOWN_CONTROLLERS`, and asserts that
  each Repositories route declares `CacheClass.UserScoped` and the account `mine.json` route
  declares its documented class, `CacheClass.Never` ([model.md](model.md#reading-it-post-authaccountminejson)).
- **`X-Skip-Cache` on the wire** is asserted by the [route access matrix](#route-access-matrix).
- **`navi/` is unchanged:** no resource file for `/repositories/*` or
  `/auth/account/mine.json`, following [cache-warmer.md](../../cache-warmer.md) (user-scoped and
  never-cached routes are never warmed). The cache agent's read-only review confirms it on each
  implementation PR; there is no Navi-specific test.

## Where tests live

- Each test is listed once, in the "Required tests" section of the file that owns its rule
  ([README.md](README.md#index)); other files link to it instead of repeating it.
- [edge-cases.md](edge-cases.md#required-tests) lists only cross-module scenario specs, all of
  type (b).
- Coverage thresholds stay as they are.
