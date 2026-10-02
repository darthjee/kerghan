# Backend Plan: Integration type: GitHub App installation

Main plan: [plan.md](plan.md)

## Shared contracts

- Produces the three routes, bodies, responses (including `redirectUrl` and the `selection`
  shape: sorted, deduplicated, ≤100, no `truncated` flag), error codes, `secretHint`, metadata
  shape and `invalid` reason codes listed in [plan.md](plan.md#shared-contracts).
- Reads the five `KERGHAN_GITHUB_APP_*` variables in
  `backend/src/integrations/types/github-app/github-app-config.ts` (infra documents them).
- `GithubAppController` is `@CachePolicy(CacheClass.Never)` (cache reviews).

## Steps

- [01 — Server config and app JWT](backend/01-config-and-jwt.md)
- [02 — Domain errors](backend/02-domain-errors.md)
- [03 — State table and service](backend/03-state.md)
- [04 — GitHub App client calls](backend/04-github-app-client.md)
- [05 — Credential, metadata and URL helpers](backend/05-type-helpers.md)
- [06 — Verification, installation and revocation services](backend/06-verification-services.md)
- [07 — Strategy](backend/07-strategy.md)
- [08 — Cool-off attempt wrapper and flow services](backend/08-flow.md)
- [09 — DTOs, guard, controller and module wiring](backend/09-http-layer.md)
- [10 — Test harness and cross-cutting specs](backend/10-tests.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- Migration: `docker-compose run --rm kerghan_app yarn migration:run` then `yarn migration:revert`

## Notes
- The spec (`docs/agents/specs/integrations/types/github-app.md`) is the source of truth for check
  order, error mapping tables and texts; each step implements its section verbatim.
- Keep every file under the 300-line lint limit: `oauth-app-flow.service.ts` is already 279 lines
  and `github-client.service.ts` 252, so github_app logic goes in new, split files.
- Keep the controller thin (project rule): all logic in the flow services.
- Secrets (code, user token, refresh token, installation token, app JWT, private key, client
  secret, `state`) are wrapped in `Secret` and never reach a logger, error message or response;
  extend the canary assertions accordingly.
- Re-check GitHub docs where the spec asks (PKCE on install, JWT `iss`, `state` surviving the
  installation page) and record the outcome in the PR description.
