# HTTP over the DB tier: canary sweep, user scoping, concurrent Adds

Some required tests need the real SQL behind the routes:

- the canary sweep across "a sync with every source status";
- user scoping over routes with the real queries;
- two concurrent Adds over HTTP.

## Harness (`repositories/tests/support/repositories-http-db-harness.ts`)

Extend `repositories-db-harness.ts` into a full HTTP app on the DB tier. It runs the real Repositories providers and controller on MySQL, with the global guards, filter and interceptor, a `FakeClock`, a `CapturingLauncher` and the `FakeIntegrationsGithubService`. It also uses a logger double that captures every log line. Sessions are minted the way the auth e2e helpers do.

Seed the two-user baseline (`two-user-baseline.ts`).

## Specs (`*.db-spec.ts`, run by `make db-tests`)

- **`repositories.routes.canary.db-spec.ts`:**
  - **Seeded as canaries:** a PAT, an OAuth token, a GitHub App private key, a minted installation token and a GitHub error body/message, wherever the fake can carry them (credential labels, `statusReason`, error messages). Also the `secret_iv` value.
  - **Flow:**
    1. Run a sync covering every source status (`runAll` on the launcher).
    2. Call the listing and the sync state.
    3. Call Add for its success and for every error: `404`, `409`, `429`, `502`, `503`.
  - **Assertion:** no response body, header or captured log line contains a canary, and no GitHub error body is echoed.
- **`repositories.routes.user-scoping.db-spec.ts`:**
  - the intruder's rows are never returned or changed by any route, or by a sync started through a route;
  - no response reveals that the intruder holds or added the same `githubId`;
  - `sources[]` and `accessIntegration` never resolve the intruder's integration;
  - after a handle change or clear, each of the four routes, called first, answers without the old handle's source rows;
  - a new handle reads `pending`.
- **`repositories.routes.add-race.db-spec.ts`:** two concurrent HTTP Adds of the same repo both answer `200` with the same `addedAt` and access link, and only one write happens. Reuse #463's `hold()` / `race-actions.ts` if the interleaving needs scripting. Don't duplicate #463's service-level race specs; this spec only asserts the HTTP answer.

## Files to Change

- `backend/src/repositories/tests/support/repositories-http-db-harness.ts`: new.
- `backend/src/repositories/tests/repositories.routes.canary.db-spec.ts`, `repositories.routes.user-scoping.db-spec.ts`, `repositories.routes.add-race.db-spec.ts`: new.
