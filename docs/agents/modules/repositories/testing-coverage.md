# Repositories — Testing coverage

What the tests must cover: concurrency, access control, module boundaries, frontend, cache and where tests live. Part of the [Repositories module](../repositories.md).
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

The cross-module scenarios of [edge cases](edge-cases.md#required-tests) are type (b) specs.

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

## Module-boundary tests

The rules are in [security](security.md#module-boundaries). Both checks are added by the first
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

## Frontend tests

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
  [routes](../../backend/routes/repositories.md)'s response shapes; specs override only the fields they test.
- **Static "no `api.github.com`" spec:** frontend sources never contain `api.github.com`. Repo
  links point to `github.com` web URLs only and are rendered as links, never fetched.

## Cache tests

- **`core/tests/cache-policy.coverage.spec.ts`** gains `RepositoriesController` (and the
  controller of `POST /auth/account/mine.json`, if new) in `KNOWN_CONTROLLERS`, and asserts that
  each Repositories route declares `CacheClass.UserScoped` and the account `mine.json` route
  declares its documented class, `CacheClass.Never` ([data model](../auth/github-handle.md#reading-it-post-authaccountminejson)).
- **`X-Skip-Cache` on the wire** is asserted by the [route access matrix](#route-access-matrix).
- **`navi/` is unchanged:** no resource file for `/repositories/*` or
  `/auth/account/mine.json`, following [cache-warmer.md](../../cache-warmer.md) (user-scoped and
  never-cached routes are never warmed). The cache agent's read-only review confirms it on each
  implementation PR; there is no Navi-specific test.

## Where tests live

- Each test is listed once, in the "Required tests" section of the doc that owns its rule;
  other files link to it instead of repeating it.
- [edge cases](edge-cases.md#required-tests) lists only cross-module scenario specs, all of
  type (b).
- Coverage thresholds stay as they are.

