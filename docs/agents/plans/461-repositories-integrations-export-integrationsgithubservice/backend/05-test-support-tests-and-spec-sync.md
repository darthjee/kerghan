# Test support, tests and spec sync

## Test support (`testing.md#github-mocking`)

- **No-network guard:** `integrations/tests/support/no-network-guard.ts`. Before each test it replaces `globalThis.fetch` with a function that throws unless the spec mocks it. Use it in the new Integrations GitHub specs only; other modules' specs stay untouched.
- **Shared builders:** `integrations/tests/support/github-builders.ts`:
  - `githubRepo({ id, private, owner, name })`, whose default ids are above 2³¹;
  - `listingPage(page, repos, { hasNext, etag })`;
  - `notModified()`, `rateLimited(resetAt)`, `unauthorized()`, `notFound()`, `timeout()`, `serverError()`, `redirect()` and `integrationUnusable(reason)`.
  - Each builder gives both a raw `fetch` response (body plus `ETag`, `Link` and `X-RateLimit-*` headers) and the expected typed result.
- **Typed fake:** `integrations/tests/support/fake-integrations-github.service.ts` holds `FakeIntegrationsGithubService`:
  - answers are scripted per (`integrationId` or `null`, operation, page);
  - every call goes to a call log, so specs can assert counts and order, including "no GitHub call";
  - an answer can be held on a deferred promise;
  - it returns the typed results only and never touches `fetch`;
  - Add goes through the same `walkAddCandidates`.

## Tests (`integrations.md#required-tests`)

All tests are unit tests at the `fetch` level, with `FakeClock` and the in-memory integrations repository, unless noted.

- **`integrations-github.service.spec.ts` (exported service):**
  - a missing or foreign id answers `missing` with no fetch;
  - `listUsableIntegrations` filters and orders correctly;
  - non-usable integrations (`expired`, `invalid`, `undecryptable`, type disabled) are never called;
  - the canary sweep: plant a canary in the credential, the minted token and the GitHub body, then assert it appears in no result, log or thrown error (`security.md#required-tests`).
- **`github-repo-client.service.spec.ts` (requests and error mapping):**
  - each operation calls its exact URL and parameters;
  - the page URL is built by the client, never taken from `Link`, same-origin included;
  - only `api.github.com` is called;
  - `integrationId: null` sends no `Authorization`;
  - the handle is URL-encoded;
  - malformed entries are dropped, and a body over 2 MiB answers `unavailable`;
  - every row of the error-mapping table is covered;
  - a `3xx` is never followed;
  - the handle listing's `404` answers `not_found`.
- **`github-client.service.spec.ts`:** extended to check that existing callers still map a `3xx` to `network_error`.
- **`core/tests/github-http-errors.spec.ts`:** the moved helpers answer the same codes, messages and statuses.
- **`integration-store.service.spec.ts` / `integrations-github.service.spec.ts` (status compare-and-set, at unit level):**
  - a `401` with the current IV sets the row `invalid`;
  - a `401` from a call made before a Replace leaves the row `active`;
  - the same holds for a mint `404`/`403` and for a decrypt failure;
  - the `(db)` versions are #463's.
- **`github-installation-token-cache.spec.ts`:**
  - a single mint serves concurrent calls (deferred fetch);
  - a token is reused until `expires_at` − 5 min on the `FakeClock`;
  - the mint body is exactly `{"permissions":{"metadata":"read"}}`;
  - eviction on `401`, delete and replace;
  - the retry-once rule, and a fresh-token `401` answers `unavailable` with the status unchanged;
  - a mint across a Replace is not cached;
  - mint `404`/`403`/JWT-`401` map as specified;
  - the token never leaves the module.
- **`add-candidate-walk.spec.ts`:**
  - `401`/`403`/`404` move on to the next candidate;
  - a rate limit, timeout, `5xx` or redirect stops the walk;
  - never more than 3 calls;
  - all denials end as `denied`;
  - no candidate ends as `no_candidate` with no call;
  - the link rules, including public-only versus found-private.
- **`github-unauthenticated-budget.spec.ts`:**
  - concurrent acquires never overshoot;
  - thresholds: with 1–10 remaining a sync acquire is refused and an Add acquire granted, and at 0 both are refused;
  - a refused acquire answers `rate_limited` with `resetAt` and makes no fetch;
  - the minimum `Remaining` is kept within a window, and a later `Reset` starts a new one;
  - after the reset passes on the `FakeClock`, calls are allowed;
  - the budget is shared between sync and Add.
- **`integrations.service.manage.spec.ts` (deletion hook):**
  - `integration.deleted` is emitted after the delete commits;
  - a failing listener is logged with safe fields, and the delete still succeeds.
  - In `integrations.controller.test-delete.e2e-spec.ts`, a throwing listener still gets `204`.
  - "Registered at boot" is #463's, since the listener lives there.
- **`integrations-github.contract.spec.ts` (fake fidelity):** runs each builder case through the real service at the `fetch` level and checks the typed result equals the fake's.

## Spec sync and README

- `docs/agents/specs/repos/integrations.md`:
  - list `walkAddCandidates` (and the public entry file) in "Exported service";
  - mark the `(db)` compare-and-set and deletion-query items as #463's;
  - name `core/clock.ts` as the `Clock`'s home.
- `docs/agents/specs/repos/sync.md#time-source` and `testing.md`: point the `Clock` and `FakeClock` at `core/`, and move the `FakeIntegrationsGithubService` ownership to #461 if the text says otherwise.
- `docs/agents/specs/repos/README.md`: add #461's row to the "Sub-issues" table.
- The PR description lists every spec change.

## Files to Change

- `backend/src/integrations/tests/support/no-network-guard.ts`: new.
- `backend/src/integrations/tests/support/github-builders.ts`: new.
- `backend/src/integrations/tests/support/fake-integrations-github.service.ts`: new.
- `backend/src/integrations/tests/*.spec.ts`: the new and extended specs listed above.
- `backend/src/core/tests/github-http-errors.spec.ts`: new.
- `docs/agents/specs/repos/integrations.md`, `sync.md`, `testing.md`, `README.md`: spec sync.
