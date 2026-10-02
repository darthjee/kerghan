# Backend Plan: Integration type: GitHub OAuth App

Main plan: [plan.md](plan.md)

## Shared contracts

What backend **produces**. Field names, statuses and codes must match exactly:

- **Env vars:** `KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` and `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET`.
  - Both are optional, read once at boot through DI.
  - Both unset or blank → disabled. Only one set, or a malformed id → boot fails.
  - When enabled, `FRONTEND_BASE_URL` is required, and it must be `https` under
    `NODE_ENV=production`.
  - Callback URL = origin of `FRONTEND_BASE_URL` + `/integrations/oauth_app/callback`.
- **`POST /integrations/oauth_app/start.json`:**
  - Body: exactly one of `{ label }` or `{ integrationId }`.
  - Answers `200 { authorizeUrl }`, where `authorizeUrl` starts with
    `https://github.com/login/oauth/authorize?`.
- **`POST /integrations/oauth_app/callback.json`:**
  - Body: `{ code, state }`.
  - Answers `201` (create) or `200` (replace) with the generic `Integration`.
- Both routes: `JwtGuard`, `OriginGuard`, `@CachePolicy(CacheClass.Never)`.
- **`types.json`:** lists `oauth_app` with `flows: { credentialPaste: false, redirect: true }` only
  when enabled.
- **`oauth_app` rows:**
  - `secretHint` `gho_…XXXX` (last 4 characters) and `expiresAt: null`;
  - `metadata` `{ scopes, clientId }`;
  - `invalid` reasons `revoked` and `insufficient_permissions`.
- Error codes, statuses and order of checks: exactly as in the spec's *Start*, *Callback* and
  *Error cases* sections.

## Steps

- [01 — Server config for the OAuth App](backend/01-server-config.md)
- [02 — GitHub client: code exchange and token revocation](backend/02-github-client.md)
- [03 — `integrations_oauth_states` table and state service](backend/03-oauth-state.md)
- [04 — `OauthAppStrategy`](backend/04-oauth-app-strategy.md)
- [05 — Flow service, DTOs and controller](backend/05-flow-service-and-controller.md)
- [06 — End-to-end specs](backend/06-e2e-specs.md)

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend/`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- Keep the controller thin (a `CLAUDE.md` boundary). All logic lives in the flow service, the
  state service and the strategy.
- `GithubClientService` stays the **only** place that calls GitHub. Every spec uses
  `tests/support/fake-github-client.ts`, extended for the two new calls.
- **Canaries:** every spec asserts that the canary token, code, `state` secret and client secret
  never reach logger calls, thrown errors, error bodies, responses (other than `state` inside
  `authorizeUrl`), stored `metadata`, or `secretHint` beyond the last 4 characters.
- The secrets (client secret, token, code, verifier) are wrapped in `Secret` as early as
  possible, and are only revealed for the outgoing GitHub request.
- No refresh logic: OAuth App tokens don't expire.
- Re-check GitHub's endpoints and parameters against GitHub's current docs.
