# Backend Plan: Repositories: Integrations — export IntegrationsGithubService

Main plan: [plan.md](plan.md)

## Overview

This plan implements `docs/agents/specs/repos/integrations.md` (all of it) and the Integrations parts of `security.md` and `testing.md`, in `backend/src/integrations/` and `backend/src/core/`. The specs are the source of truth. Any change to them made here is listed in the PR description.

## Context

- `IntegrationsModule` currently exports only `IntegrationsKeyRotationService`.
- `GithubClientService#send` (`integrations/github-client.service.ts`) is today the only place that calls GitHub. It applies `redirect: 'error'`, a 10 s timeout and a capped body read. `rateLimitFields` and the body helpers live in `integrations/github-http.ts`.
- GitHub App installation tokens are minted per use (`GithubAppClientService#createInstallationToken`). That call never reads the token, and the app JWT comes from `types/github-app/github-app-jwt.ts#mintAppJwt`.
- Decrypting a row goes through `decryptRow(encryption, strategy, row)` in `integration-connection-test.service.ts`, which returns `null` when the row is undecryptable. The reported status comes from `integration-response.ts#reportedStatus(row, keyIsDecryptable, now)`.
- The bad-credentials reasons are:
  - `pat`: `PAT_REASON_BAD_CREDENTIALS = 'bad_credentials'`;
  - `oauth_app`: `OAUTH_APP_REASON_REVOKED = 'revoked'`;
  - `github_app`: `GITHUB_APP_REASON_UNINSTALLED` and `GITHUB_APP_REASON_SUSPENDED`.
- An integration type is enabled when `IntegrationTypeRegistry` lists it as enabled (`strategy.isEnabled?.() ?? true`).
- `@nestjs/event-emitter` is already installed, and `EventEmitterModule.forRoot()` is already registered in `AppModule`. No new package is needed.
- `githubUnavailable()` and `githubRateLimited()` currently live in `integrations/integration-http-errors.ts`.

Decisions recorded on the issue:
1. #461 ships `FakeIntegrationsGithubService`, the shared builders and the contract spec.
2. A shared `Clock` goes in `core/clock.ts`.
3. The `secret_iv` compare-and-set is unit-tested here. Its `(db)` specs move to #463, so #461 has no dependency.
4. Only the emitter side of the deletion hook is built here.

## Steps

- [01 — Core: Clock and shared 502/503 helpers](backend/01-core-clock-and-http-errors.md)
- [02 — Repo client: endpoints, error mapping, redirect option](backend/02-repo-client-and-error-mapping.md)
- [03 — Token cache, budget tracker and status compare-and-set](backend/03-token-cache-budget-and-cas.md)
- [04 — IntegrationsGithubService, Add walk, export and deletion event](backend/04-service-walk-export-and-event.md)
- [05 — Test support, tests and spec sync](backend/05-test-support-tests-and-spec-sync.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- **Add walk placement.** `integrations.md` lists four fixed operations, and its "Add" required tests sit in Integrations. The walk needs to know which integrations hold a source row, and that data lives in Repositories. The walk is therefore a pure function exported from Integrations, `walkAddCandidates`. It takes the inputs computed by Repositories (holder integration ids, whether the handle sees the repo) plus the usable list, and calls `getRepository`. The real service and the fake share it. Update `integrations.md#exported-service` to list it as the one extra export, and record the change in the PR description.
- **`(db)` items moved to #463.** These are the `secret_iv` compare-and-set and the integration-deletion queries. Update `integrations.md#required-tests` (and `testing.md` if needed) to say these run in #463's DB-backed tier.
- **Out of scope:**
  - the Repositories listener, the ESLint boundary override and the static boundary spec, all in #463;
  - permanent docs such as `modules/integrations/github-app.md`, which #452 updates.
- **Security review.** Ask for one on the PR, covering the credential flow, the token cache and the redirects.
- **No secrets in logs.** Every log line carries safe fields only: integration id, operation, HTTP status and result kind. Never a body, token, IV or URL query.
