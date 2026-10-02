# Plan: Integration type: GitHub OAuth App

Issue: [302-integration-type-github-oauth-app.md](../../issues/302-integration-type-github-oauth-app.md)

## Overview

Implement the `oauth_app` integration type end to end, exactly as defined in
[`docs/agents/specs/integrations/types/oauth-app.md`](../../specs/integrations/types/oauth-app.md)
(the source of truth for every detail below). The backend adds:

- an `OauthAppStrategy` plugged into the existing type registry;
- a server-side, single-use, PKCE-backed `state` table;
- a thin controller for `start` and `callback`, plus a flow service that reuses the generic
  credential pipeline (cool-off, seal, store);
- best-effort token revocation.

The frontend adds the redirect flow: a label-only form, *Reconnect with GitHub*, and a landing
handler that clears `code` and `state` from the URL before any request. Tent gets a dedicated
landing rule that sends `no-store` and `no-referrer`. Infra documents the two env vars, and cache
checks that nothing new is warmed.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)
- [proxy](proxy.md)
- [infra](infra.md)
- [cache](cache.md)

Review only, after implementation: `security` (OAuth flow, `state`/PKCE, secret handling) and
`data-access` (new endpoints, owner scoping), as required by the issue.

## Shared contracts

### Env vars (backend reads them, infra documents them)

- `KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` (optional): `1–100` characters of `[A-Za-z0-9._-]`.
- `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET` (optional, secret).
- Both unset or blank → the type is disabled. Only one set, or a malformed client id → boot fails.
- With the type enabled, `FRONTEND_BASE_URL` is required, and its origin must be `https` under
  `NODE_ENV=production`.
- Callback URL = origin of `FRONTEND_BASE_URL` + `/integrations/oauth_app/callback`.

### Routes (backend produces, frontend consumes)

All routes are `POST`, behind `JwtGuard` and `OriginGuard`, with `@CachePolicy(CacheClass.Never)`
(`X-Skip-Cache`, `Cache-Control: no-store`).

| Route | Request body | Success |
|---|---|---|
| `POST /integrations/oauth_app/start.json` | `{ "label": "Work" }` (create) **or** `{ "integrationId": "<uuid>" }` (replace) — exactly one | `200` `{ "authorizeUrl": "https://github.com/login/oauth/authorize?…" }` |
| `POST /integrations/oauth_app/callback.json` | `{ "code": "…", "state": "<uuid>.<43 base64url chars>" }` | `201` `Integration` (create) or `200` `Integration` (replace) |

- `POST /integrations/types.json` lists `{ "type": "oauth_app", "flows": { "credentialPaste": false, "redirect": true } }`
  only when the type is enabled.
- Generic `POST /integrations.json` and `POST /integrations/:uuid/credential.json` with
  `oauth_app` → `400 INTEGRATION_FLOW_UNSUPPORTED` (already done by the generic pipeline, since
  `credentialPaste: false`).
- Error codes the frontend must map: `NOT_FOUND` 404 (type disabled, or the target is foreign or
  missing), `VALIDATION_FAILED` 400, `INTEGRATION_FLOW_UNSUPPORTED` 400,
  `INTEGRATION_REDIRECT_STATE_INVALID` 400, `INTEGRATIONS_LIMIT_REACHED` 409,
  `INTEGRATION_LABEL_TAKEN` 409, `INTEGRATION_CREDENTIAL_INVALID` 422,
  `INTEGRATION_INSUFFICIENT_PERMISSIONS` 422, `INTEGRATION_CREDENTIAL_LOCKED` 423,
  `GITHUB_UNAVAILABLE` 502, `GITHUB_RATE_LIMITED` 503 (+ `Retry-After`).

### `oauth_app` integration response fields (generic `Integration` shape)

- `type: "oauth_app"`
- `secretHint`: `gho_…` plus the last 4 characters (U+2026 ellipsis)
- `expiresAt: null`
- `metadata: { "scopes": ["repo"], "clientId": "<client id>" }`
- `statusReason` for `invalid`: `revoked` or `insufficient_permissions`

### Landing (proxy serves it, frontend handles it)

- `GET /integrations/oauth_app/callback?code=…&state=…` (or `?error=…&state=…`) returns the SPA's
  `index.html` directly, with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. It
  never goes through the hash redirect or the backend rule.
- The frontend's first action on that path: `history.replaceState(null, '', '/#/account/integrations')`.
- The SPA's assets are referenced by absolute `/assets/…` paths, so they load from the nested
  path.

## Notes

- Execution order: backend first (frontend specs mock the client, so frontend can run in
  parallel), then proxy and infra in parallel, then cache. The security and data-access reviews
  come last.
- The spec's *Manual smoke check* is **not** a merge requirement. The owner runs it after merge
  with a throwaway OAuth App, so link to that section in the PR description as a post-merge
  step.
- Enabling the type in production (registering the production OAuth App and setting the host
  env vars) is out of scope.
- Re-check GitHub's OAuth endpoints, parameters and headers against GitHub's current docs while
  implementing (the spec asks for this).
