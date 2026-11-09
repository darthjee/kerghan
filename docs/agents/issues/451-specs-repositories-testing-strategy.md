# Issue: Specs: repositories — testing strategy

## Description

Part of Epic #444 (repositories listing). This is the last spec-enhancement sub-issue before the implementation sub-issues.

It settles the **testing strategy** for the Repositories specs in `docs/agents/specs/repos/`:

- how GitHub is mocked, with no real GitHub calls in CI;
- how SQL semantics are proven on a real database;
- how the detached sync and time are controlled;
- how races are driven;
- how access control, credential leaks and module boundaries are checked;
- how the frontend Jasmine specs are structured;
- what the cache must never do.

It also makes every "Required tests" section consistent: each test has one owner file.

It is docs only.

## Problem

- Every "Required tests" section is still open (the `#451` marker in README.md, plus the notes in `api.md` and `ui.md`).
- CI has no database. The in-memory fake cannot prove the SQL semantics the specs rely on: atomic claims, unique keys, transactions, compare-and-set, conditional writes, `bigint`.
- The sync runs detached and depends on time (TTL, cooldown, lease, deadline, token expiry, rate-limit resets), but no rule says how tests await it or control time.
- No rule says how GitHub is faked for the Repositories module versus the Integrations client, or what prevents a real GitHub call.
- The same tests are listed in several files (Add candidate walk, budget tracker, redirects, deletion cleanup, zombie run, handle validation, concurrent claim, …).

## Expected Behavior

- `docs/agents/specs/repos/testing.md` exists, is indexed from README.md, and holds every decision in [Solution](#solution).
- Every "Required tests" section opens with a link to `testing.md`. Items whose tier differs from their category's default carry an exception tag. The `#451` notes and the Open-markers row are gone.
- The Clock, no-`NOW()` and `SyncLauncher` rules are in `sync.md`, which `model.md` cites. `integrations.md` states that its token cache and budget tracker read the Clock. `security.md` states the boundary tooling.
- After the consistency pass, no test bullet appears in two files, and every link resolves.
- README.md's Decisions summary and #452 fold checklist are updated.
- No code, CI, ESLint, package or compose changes.

## Solution

### Shape and location

- **New file `docs/agents/specs/repos/testing.md`.** It holds the whole strategy:
  - test tiers;
  - GitHub mocking;
  - time and concurrency control;
  - frontend specs;
  - cache/Navi expectations.
- **README.md changes:**
  - a row for `testing.md` in the Index;
  - remove the `#451` row from "Open markers";
  - its "Required tests" line points to `testing.md`.
- **Every spec file's "Required tests" section** opens with one line linking `testing.md`.
  - The `#451` notes in `api.md` and `ui.md` are replaced by that line.
- **Tiering uses a category table plus exception tags:**
  - `testing.md` maps rule categories to a default tier, for example "atomic claims, unique keys, transactions, compare-and-set → DB-backed".
  - Inline tags such as `(db)` or `(static)` go only on items whose tier differs from their category's default, so the bullets stay readable.
- **`edge-cases.md`** keeps its role: it lists only cross-module scenario tests.
- **#452** folds `testing.md` into:
  - the Repositories module doc ("Testing");
  - `architecture/backend.md#testing`, for any general rule it introduces (e.g. a DB tier).

### Real database tier

The in-memory fake (`auth/tests/support/in-memory-repo.ts`) cannot prove the SQL semantics the specs rely on, so `testing.md` adds a **narrow DB-backed tier on real MySQL 8**.

**Default tier: DB-backed** for these categories:

- the atomic sync claim, a conditional `UPDATE` whose affected-row count decides the outcome;
- first-use creation of the sync-state row with no duplicates;
- `run_id`-guarded writes;
- unique keys (`user_id` + `github_id`, `source_key` rows);
- per-page transactions: a later page fails and the pages already applied are kept;
- the `secret_iv` compare-and-set and Add's conditional `added_at IS NULL` write;
- pruning, integration-deletion and `user.deleted` deletion queries, including user scoping across two users' rows;
- a `github_id` above 2³¹ stored and read back exactly (`bigint`);
- the Repositories migrations, run up and down for real.

**Everything else stays on the existing tiers.** Controllers, DTOs, guards, the service flow and the error mapping use unit specs and e2e specs with fakes, following the module convention.

**Setup:**

- **Suffix:** `*.db-spec.ts`. These specs are excluded from the default `yarn test` run.
- **Runner:** a separate Jest config and script, `yarn test:db`.
  - It runs serially.
  - It uses a dedicated test schema: migrations run once per run, and the Repositories tables are truncated before each test.
- **Locally:** it runs through docker-compose against the existing MySQL service. Never on the host.
- **CI:** a new job with a `cimg/mysql:8.0` service container. The release and deploy jobs require it, like `backend_tests`.
- **Who adds it:** the first implementation sub-issue that needs it adds the job, the script and the docs. This matches `architecture/backend.md#testing` ("add a `cimg/mysql` service … when the first spec actually needs a real database"). #452 then records the tier in `architecture/backend.md#testing`.
- **Existing specs are unchanged.** The other modules keep their fakes, and the Integrations migration specs keep the fake query runner.

### GitHub mocking

There are two layers, one per module. No test of the feature calls the real GitHub.

**Integrations module (fetch level).**

- The single GitHub client and `IntegrationsGithubService` are tested by spying on `globalThis.fetch`, following `github-client.service.spec.ts`.
- These specs prove the request and its handling:
  - the URL and parameters (`per_page=100&page=N`, `type=owner`, `sort=created`);
  - `Authorization`, or no header at all for unauthenticated calls;
  - `If-None-Match`;
  - `redirect: 'manual'`;
  - rate-limit header parsing and the budget tracker;
  - installation-token minting and caching;
  - the error mapping table.

**Repositories module (typed fake).**

- Every Repositories spec (unit, e2e and DB) injects a scriptable `FakeIntegrationsGithubService`. It returns the exported typed results and never touches `fetch`, since Repositories holds no HTTP code.
- **Scripting:** answers are scripted per (`integrationId` or `null`, operation, page). Every call is logged so specs can assert call counts and order, including "no GitHub call".
- **Race control:** an answer can be held on a deferred promise for race tests.

**Shared typed builders** (test support, no recorded JSON):

- `githubRepo({ id, private, owner, name })`, with default ids above 2³¹;
- `listingPage(page, repos, { hasNext, etag })`;
- `notModified()`, `rateLimited(resetAt)`, `unauthorized()`, `notFound()`, `timeout()`, `serverError()`, `redirect()`, `integrationUnusable(reason)`.

**How the two layers use the builders:**

- Integrations specs turn a builder into a raw GitHub response: body, `ETag`, `Link`, `X-RateLimit-*` headers.
- The fake returns the matching typed result.
- **Fake fidelity:** an Integrations contract spec runs each builder case through the real service at the fetch level. It asserts that the typed result equals what the fake returns for the same builder, so the fake cannot drift from the real service.

**No-network guard.**

- The Repositories and Integrations GitHub test harnesses replace `globalThis.fetch`, before each test, with a function that throws unless the spec mocks it.
- Other modules' specs are untouched.

### Detached sync and time control

**Detached run: injected launcher.**

- The sync is started through an injected `SyncLauncher`. Its `launch(task)` detaches the task and catches its errors, so production behaviour is unchanged.
- Tests swap in a `CapturingLauncher` that records tasks without running them. A spec can then prove two things:
  - the triggering request answered with stored rows and the sync state, with no GitHub call logged by the fake;
  - after `await launcher.runAll()` (which runs the captured tasks and resolves once they settle), the run's effects are visible.
- Race specs can run a captured task step by step, together with the fake's deferred answers.

**Time: injected `Clock`.**

- The Repositories module, the installation-token cache and the unauthenticated budget tracker read time from an injected `Clock` (`now(): Date`), never from `Date.now()` directly.
- Tests use a `FakeClock` with `set(date)` and `advance(ms)` to drive every time rule:
  - the TTL, the Refresh cooldown, the lease and its heartbeat, and the hard deadline;
  - the `resetAt` of a `rate_limited` source and the budget tracker's reset window;
  - token expiry minus 5 min;
  - the Add rate-limit window.
- **New spec rule (`sync.md`, also cited in `model.md`):** every time condition in SQL (lease expiry, TTL, cooldown, heartbeat) compares against an app-supplied timestamp parameter from the `Clock`, never `NOW()` / `CURRENT_TIMESTAMP`. That way the DB tier is driven by the same clock, and the app and the database never disagree about time.
- `jest.useFakeTimers` stays only for the per-call HTTP timeout in the Integrations fetch-level specs, which follows the existing convention.

### Concurrency and race tests

There are two kinds of race test, and production code gets no test-only hooks.

**(a) True parallelism, DB tier.**

- Cases:
  - the atomic claim (two triggers start exactly one sync; the claim is refused inside the cooldown or while another run holds an unexpired lease);
  - first-use creation of the sync-state row;
  - concurrent handle reconciliation, which happens once;
  - a double Add, which writes once and gets `200` twice.
- Each fires N operations at once with `Promise.all` on separate pool connections, then asserts the **invariants**: exactly one claim, one row, one write, and the expected answers. Invariant assertions do not depend on which interleaving happened, so they don't flake.
- No repeat loops.

**(b) Scripted interleaving (deterministic).**

- The only pause points are GitHub calls (a deferred answer from `FakeIntegrationsGithubService`) and the `CapturingLauncher`.
- A spec pauses the run at a GitHub call, performs the competing action, releases the answer, then asserts.
- The competing actions:
  - delete the integration;
  - replace its credential (the `secret_iv` compare-and-set);
  - change the handle;
  - Add the repo;
  - delete the user;
  - advance the `FakeClock` past the lease and start run B, which covers the zombie writes and lock release by `run_id`;
  - pass the hard deadline.
- "A page written after the deletion hook's cleanup" is the paused page answer released after the deletion. That is how the end-of-sync safety net is tested.
- **Integrations-level races** (installation-token single-flight, concurrent budget acquires never overshooting) use deferred `fetch` replies in the fetch-level specs.

The matching cross-module scenarios in `edge-cases.md` are type (b) specs.

### Access control and credential-leak tests

**Route access matrix: a table-driven e2e spec plus a completeness check.**

- One table-driven e2e spec follows `integrations.controller.access.e2e-spec.ts`.
- **Routes covered:**
  - the four Repositories routes;
  - `POST /auth/account/mine.json`;
  - the handle path of `PATCH /auth/account.json`.
- **Rules checked on every row:**
  - `401 UNAUTHORIZED` without a session;
  - rejected by `OriginGuard` from a foreign origin;
  - the `X-Skip-Cache` header is sent;
  - for repo-ref routes, a foreign repo answers a body identical to a missing one (timestamp ignored);
  - an admin session gets no access to another user's repositories;
  - `/admin/users/*` carries no repository-derived field and no `githubHandle`.
- **Completeness:** the spec compares its table with the controllers' registered routes, read from Nest metadata. A Repositories route missing from the table fails the spec.

**Credential canary sweep.** It reuses the existing `CANARY_*` pattern.

- **Canaries seeded:**
  - a PAT;
  - an OAuth token;
  - a GitHub App private key;
  - a minted installation token;
  - a GitHub error body/message.
- **Flow exercised:**
  - a sync with every source status;
  - the listing and the sync state;
  - Add's success and every Add error (`404`, `409`, `429`, `502`, `503`).
- **Assertion:** no response body, response header or captured log line contains any canary.
- **Fetch-level spec:** the Integrations side also asserts that `Authorization` is never sent off `https://api.github.com` and that installation tokens are minted with `metadata: read` only.

**Two-user baseline.**

- Every Repositories e2e and DB harness seeds an intruder user holding a row with the same `github_id` and an integration of its own.
- Every spec can therefore assert that the intruder's rows are untouched and never returned, on top of the dedicated scoping specs.

### Module-boundary checks

These rules are enforced by tooling, not left to review alone.

**ESLint override for `backend/src/repositories/**`:**

- `no-restricted-imports` lets Repositories import from Integrations and Auth only through their exported entry points:
  - `IntegrationsGithubService` and its typed results;
  - `AccountHandleService`;
  - the `integration.deleted` / `user.deleted` event types.
- Their entities, the encryption service and the GitHub client are refused.
- `no-restricted-globals` bans `fetch` in Repositories: it holds no HTTP code.

**Static Jest spec** (`*.spec.ts`, in the style of `core/tests/cache-policy.coverage.spec.ts`; no app boot, no DB):

- It scans `repositories/**` sources, excluding tests, for these forbidden tokens:
  - `auth_users` and `integrations` table names in query strings or `@Entity` mappings;
  - `secret_iv`;
  - `NOW(` / `CURRENT_TIMESTAMP` (the Clock rule).
- It asserts that no Repositories entity maps an `auth_users` or `integrations` table.
- It asserts that the exported `IntegrationsGithubService` result types carry no credential field. This is checked against a fixed allowlist of each result's keys.

**Review still applies.** The security and data-access agents review the implementation PRs as usual. Tooling catches regressions between reviews.

### Frontend Jasmine specs

The specs follow the house style of the Integrations page, in three layers. Each spec file mirrors its source under `frontend/specs/assets/js/`.

1. **Client spec (`RepositoriesClient`):**
   - uses `specs/support/fetchSequence.js`;
   - covers every route's method (`POST`), URL and body;
   - covers the mapping of error answers to `ApiError`, including `error.retryAfterSeconds`;
   - covers the `AccountsClient` additions (`POST /auth/account/mine.json`, the handle-only `PATCH`).
2. **Controller specs:**
   - use a harness like `integrationsControllerHarness.js`: a fixed `NOW`, state-setter spies, `jasmine.clock()` and `flushMicrotasks`;
   - cover:
     - polling every 2 s and when it stops;
     - the Refresh countdown and its `429` adoption;
     - Add state kept by `githubId` across a reload;
     - banner dismissal per (source, status, `syncedAt`);
     - the empty-page jump to the last page;
     - frozen rows while syncing;
     - the Added row under the "Not added" filter;
     - the Account handle section's load, save and validation flow.
3. **Render specs:**
   - use `elementTree` / `renderedOutput`;
   - cover:
     - texts, links (the `https://github.com/<owner>/<name>` URL-encoding, the Integrations and Account links);
     - muted badges and tooltips;
     - banners per status;
     - the three empty states and the no-match message;
     - the spinner vs the syncing indicator;
     - the navbar link (logged in vs awaiting approval);
     - the handle section;
     - no handle on the admin user pages.

**Shared builders.** `buildRepository`, `buildSyncState` and `buildSource` in `specs/support/` mirror `api.md`'s response shapes. Specs override only the fields they test.

**Static spec for "No frontend request goes to GitHub":** frontend sources never contain `api.github.com`. Repo links point to `github.com` web URLs only and are rendered as links, never fetched. The client spec also asserts that every request targets Kerghan's API base.

### Navi / cache expectations

- **`core/tests/cache-policy.coverage.spec.ts` gains:**
  - `RepositoriesController` (and the controller of `POST /auth/account/mine.json`, if new) in `KNOWN_CONTROLLERS`;
  - an assertion that each Repositories route, and the account `mine.json` route, declares `CacheClass.UserScoped`.
- **`X-Skip-Cache` on the wire** is asserted by the route access matrix.
- **`navi/` is unchanged.** No resource file for `/repositories/*` or `/auth/account/mine.json`, following `cache-warmer.md` ("user-scoped and never routes are never warmed").
- **Review:** the cache agent's read-only review confirms this on each implementation PR. There is no Navi-specific test.

### Scope

**In scope (docs only, under `docs/agents/specs/repos/`):**

- **New `testing.md`.** It holds:
  - the tiers;
  - the category → default tier table;
  - GitHub mocking and the builders;
  - the launcher and the clock;
  - race tests;
  - access/canary/boundary checks;
  - frontend layers;
  - cache expectations.
- **Every "Required tests" section:**
  - the opening link to `testing.md`;
  - exception tier tags;
  - the new items the new rules need.
  - The `#451` notes in `api.md` and `ui.md` are removed.
- **Design rules recorded in their owning file:**
  - in `sync.md`: the injected `Clock`, the "no `NOW()` / `CURRENT_TIMESTAMP` in SQL time conditions" rule, and the injected `SyncLauncher`;
  - `model.md` cites them;
  - in `integrations.md`: the token cache and budget tracker read the `Clock`;
  - in `security.md`: the module-boundary tooling (ESLint override and static spec).
- **`README.md`:**
  - the Index row for `testing.md`;
  - the `#451` Open-markers row removed (the table then reads "none");
  - Decisions summary bullets;
  - the "Required tests" line points to `testing.md`.
  - Additions to the #452 fold checklist:
    - `architecture/backend.md#testing` (the DB tier, `*.db-spec.ts`, `yarn test:db`, the Clock/launcher conventions);
    - `architecture/infra.md` (the MySQL CI job);
    - the Repositories module doc ("Testing");
    - `contributing.md`, if the ESLint override needs a mention.

**Out of scope:**

- Any code, CI, ESLint, `package.json` or docker-compose change. The implementation sub-issues add the DB job, `test:db`, the ESLint override, the fakes and the builders, each when first needed.
- Changes to other modules' existing specs or to the shared in-memory fake.
- Coverage thresholds. They stay as they are.

### Consistency pass over "Required tests"

**Rule: one owner plus links.**

- Each test lives once, in the file that defines its rule (the rule owner, per the README Index).
- Other files replace their copy with a one-line link to the owner's item, such as "Candidate walk: [integrations.md](integrations.md#required-tests)". A link is used only where the cross-reference helps the reader; otherwise the copy is simply dropped.
- `api.md` drops its "Backend e2e. … is #451's." line in favour of the `testing.md` link. `ui.md` drops its "#451's" line the same way.

**Owner assignments for the overlaps found:**

| Test | Owner | Others become links |
|---|---|---|
| Add candidate walk (move on / stop / ≤ 3 calls / `409` with no candidate) | `integrations.md` | `api.md` keeps only the HTTP answers it maps to |
| Budget tracker (reservations, thresholds ≤ 10 / ≤ 0, out-of-order responses) | `integrations.md` | `sync.md` keeps only "a refused acquire marks the source `rate_limited`" |
| `401` / mint `404`/`403` → `invalid`, with the `secret_iv` compare-and-set | `integrations.md` | `sync.md` keeps the handle fallback after a `401` |
| Non-usable integrations never called | `integrations.md` | `sync.md` keeps "its source stores `invalid_credentials`/`error` and keeps its rows" |
| Handle `404` | `integrations.md` (maps to `not_found`) | `sync.md` keeps the source effect (rows kept, no fallback, retried); `model.md` keeps the row status (Unknown) |
| Fixed host, no redirect followed, own page URLs | `integrations.md` | `sync.md` keeps "a redirect makes the source `error`"; `security.md` links |
| Zombie run / `run_id` guards / lock release | `sync.md` | `security.md` links |
| Integration-deletion cleanup (rows dropped, link cleared, prune) | `model.md` | `integrations.md` keeps the event emission and the listener's failure handling; `sync.md` keeps the end-of-sync safety net; `security.md` links |
| Handle normalisation, validation, edit path, default user, admins | `model.md` | `security.md` links |
| Concurrent claim / one sync at a time / cooldown | `sync.md` | `api.md` keeps the `202` / `429` answers; `security.md` links |
| Per-route `401`, `OriginGuard`, `X-Skip-Cache`, cache class, foreign = missing `404`, admins | `security.md` (the route access matrix) | `api.md` links |
| No credential in any response or log (canary sweep) | `security.md` | `api.md` and `integrations.md` link |

**Other parts of the pass:**

- **New items.** Each owner file gains the items the new rules need:
  - `sync.md`: the Clock and no-`NOW()` rule, and the launcher (the triggering request answers before the captured task runs);
  - `security.md`: the ESLint override and the static boundary spec;
  - `integrations.md`: the fake-fidelity contract spec;
  - `ui.md`: the static "no `api.github.com`" spec.
- **`edge-cases.md`.** Its scenarios stay as they are and are tagged as scripted-interleaving (b) specs.
- **Final check.** After the pass, no test bullet appears in two files. Every link resolves to an existing item in its owner's "Required tests".

## Benefits

- Implementation sub-issues get one agreed way to test, so each spec file's "Required tests" maps to a concrete tier and harness, with no per-issue reinvention.
- Correctness rules that only a real database can prove (claims, compare-and-set, conditional writes, unique keys) are actually proven, not assumed.
- Tests are deterministic: there is no real network, no wall-clock time and no repeat loops.
- Credential safety and module boundaries are enforced by tooling, not only by review.
- Each test lives in one place, so test lists cannot drift apart before #452 folds them into the permanent docs.
