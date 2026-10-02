# Plan: Integration type: GitHub App installation

Issue: [303-integration-type-github-app-installation.md](../../issues/303-integration-type-github-app-installation.md)

## Overview
Implement the `github_app` integration type end to end, exactly as specified in
`docs/agents/specs/integrations/types/github-app.md` (the source of truth for every route, check
order, error code, shape and UI text). The backend adds config/JWT, a dedicated state table, GitHub
App client calls, the verification/flow services, the strategy and three type-owned routes
(`start.json`, `callback.json`, `select.json`). The frontend adds the type module, install/connect
modes, the landing handler, the installation selection UI and the disabled-type behaviour. The
proxy adds the landing path to the existing landing rules. Infra documents the five variables. One
PR, same shape as #302.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)
- [proxy](proxy.md)
- [infra](infra.md)
- [cache](cache.md) (review only)

Reviewers after implementation: `security` (install/connect/select claim flow, state, secrets),
`data-access` (new endpoints and response fields).

## Shared contracts

### Routes (all `POST`, behind `JwtGuard` + `OriginGuard`, `@CachePolicy(CacheClass.Never)`)

| Route | Body | Success |
|---|---|---|
| `/integrations/github_app/start.json` | `{ label: string, mode?: "install"\|"connect" }` (create) or `{ integrationId: uuid, mode?: ... }` (replace); exactly one of `label`/`integrationId` | `200 { "redirectUrl": "https://github.com/..." }` |
| `/integrations/github_app/callback.json` | `{ code, state, installationId?: number, setupAction?: "install"\|"update" }` (`setupAction` required iff `installationId`) | `201 Integration` (create), `200 Integration` (replace), or `200 { "selection": { "state": "<uuid>.<secret>", "installations": [{ "installationId": number, "accountLogin": string, "accountType": "User"\|"Organization" }] } }` |
| `/integrations/github_app/select.json` | `{ state, installationId: number }` | `201 Integration` (create) or `200 Integration` (replace) |

- The start response field is **`redirectUrl`** (OAuth App's is `authorizeUrl`; do not rename either).
- `installations` is sorted by `accountLogin` (case-insensitive), deduplicated by `installationId`,
  at most 100 entries. There is **no** `truncated` flag: the frontend shows the "only the first 100
  are shown" notice when it receives exactly 100.
- Type disabled → 404 `NOT_FOUND` on all three routes (before validation). `types.json` omits
  `github_app`.
- Redirect URL shapes the frontend allow-lists:
  `^https://github\.com/apps/[a-z0-9-]+/installations/new\?` (install) or prefix
  `https://github.com/login/oauth/authorize?` (connect).

### Error codes (all already in `backend/src/core/error-codes.ts`)
`NOT_FOUND` 404, `VALIDATION_FAILED` 400, `INTEGRATION_FLOW_UNSUPPORTED` 400,
`INTEGRATION_REDIRECT_STATE_INVALID` 400, `INTEGRATIONS_LIMIT_REACHED` 409,
`INTEGRATION_LABEL_TAKEN` 409, `INTEGRATION_CREDENTIAL_INVALID` 422,
`INTEGRATION_INSTALLATION_NOT_ACCESSIBLE` 422, `INTEGRATION_INSUFFICIENT_PERMISSIONS` 422,
`INTEGRATION_INSTALLATION_SUSPENDED` 422, `INTEGRATION_CREDENTIAL_LOCKED` 423,
`GITHUB_UNAVAILABLE` 502, `GITHUB_RATE_LIMITED` 503.

### Integration row (generic `Integration` response) for `github_app`
- `secretHint`: `installation …` + last 4 digits of the installation id.
- `githubLogin`: the installation account's login. `expiresAt`: always `null`.
- `metadata`: `{ installationId, appId, accountLogin, accountType: "User"|"Organization",
  repositorySelection: "all"|"selected", permissions: { issues, metadata }, verifiedBy }`.
- `invalid` reason codes: `uninstalled`, `suspended`, `insufficient_permissions` (texts in the
  spec's *`invalid` reason codes* table).

### Landing path and server config
- Landing: `GET /integrations/github_app/callback?code&state[&installation_id&setup_action][&error]`,
  served by Tent as the SPA's `index.html` with `Cache-Control: no-store` and
  `Referrer-Policy: no-referrer`.
- Env vars (backend, all-or-nothing): `KERGHAN_GITHUB_APP_ID`, `KERGHAN_GITHUB_APP_SLUG`,
  `KERGHAN_GITHUB_APP_PRIVATE_KEY` (one-line base64 of the PEM), `KERGHAN_GITHUB_APP_CLIENT_ID`,
  `KERGHAN_GITHUB_APP_CLIENT_SECRET`. Callback URL = origin of `FRONTEND_BASE_URL` +
  `/integrations/github_app/callback`. Config source file:
  `backend/src/integrations/types/github-app/github-app-config.ts`.

## Notes
- Re-check against GitHub's docs during implementation (spec asks): whether the install flow
  forwards PKCE; `iss` = client id vs app id for the app JWT; that `state` survives the
  installation page; the callback query parameters.
- Run the spec's *Manual smoke check (#303)* in dev with a throwaway GitHub App before marking ready.
- Registering the production GitHub App and setting its values in Render is a manual ops step,
  out of scope.
