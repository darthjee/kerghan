# Issue: Integration type: GitHub App installation

## Description
Part of #295 (GitHub integrations). Implement the **GitHub App installation** integration type (`github_app`) end to end — backend, frontend, proxy and infra — exactly as specified in `docs/agents/specs/integrations/types/github-app.md`, on top of the generic `integrations` module (#300), the Integrations page (#301) and the redirect plumbing added with the OAuth App type (#302 / PR #312).

The spec is the source of truth; this issue only lists what has to be built and how it is verified. Where this list and the spec disagree, the spec wins.

## Problem
Users can store a Personal Access Token or authorize Kerghan's OAuth App, but cannot connect a **GitHub App installation**, the type that gives fine-grained, per-repository, organization-friendly access without storing any long-lived token.

## Expected Behavior
- A user can add a *GitHub App* integration either by **installing** Kerghan's GitHub App on an account (`mode: "install"`) or by **connecting an existing installation** they can access (`mode: "connect"`), picking one when several are available.
- Ownership of the installation is proven through the user token (`GET /user/installations`), never through the `installation_id` from the redirect alone; a forged or guessed id is rejected with `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE` and counts toward the cool-off.
- Only the installation id and metadata are stored; installation tokens are minted on demand from the app private key (app JWT).
- *Test connection* reports `active`, or `invalid` with the `suspended` / `uninstalled` reason codes; `unavailable` while the type is disabled.
- Deleting the integration does nothing on GitHub.
- Without the five server config variables the type is disabled: hidden from the picker, its routes answer 404, existing rows can still be renamed and deleted.

## Solution
- **Backend** (`backend`):
  - `github_app` strategy (redirect-only flow; generic create/replace answer `INTEGRATION_FLOW_UNSUPPORTED`).
  - `POST /integrations/github_app/start.json`, `callback.json` and `select.json`, with `install` and `connect` modes, `redirect`/`select` state rows bound to `req.user.sub`, checks in the spec's order (disabled → 404, validation, owner lookup, cool-off, cap/label).
  - Code exchange, user-token installation check, app-JWT installation checks (permissions, suspended), storage of installation id + metadata.
  - On-demand installation token minting; test connection; no-op `onDelete`.
  - Server config read once at boot: `KERGHAN_GITHUB_APP_ID`, `_SLUG`, `_PRIVATE_KEY` (base64 PEM, RSA), `_CLIENT_ID`, `_CLIENT_SECRET`; all-or-nothing, fail boot on partial/malformed config; callback URL derived from `FRONTEND_BASE_URL` (https required in production). Secrets never logged or returned.
  - Re-check GitHub's docs for endpoints/params, including whether the install flow forwards PKCE.
- **Frontend** (`frontend`): *GitHub App* in the type picker with *Install on GitHub* / *Connect existing installation*, redirect URL allow-list check before `window.location.assign`, landing handling at `/integrations/github_app/callback` (success, errors, installation selection list capped at 100), disabled-type state for existing rows, Remove confirmation text, per the spec's UI guidance.
- **Proxy** (`proxy`): dedicated landing rule for `GET /integrations/github_app/callback` in dev and prod configuration, winning over `backend.php`/`redirects.php`, reusing #302's headers middleware (`Cache-Control: no-store`, `Referrer-Policy: no-referrer`). No new rule for the `.json` routes.
- **Cache** (`cache`, review only): the three routes are `@CachePolicy(CacheClass.Never)` and are not added to Navi.
- **Infra** (`infra`): document the five variables and per-environment GitHub App registration in `docs/agents/environment-variables.md`; add commented entries to `.env.dev.sample`; leave CI unset (type disabled); make docker-compose and the deploy pass the five variables through to the production backend. Registering the production GitHub App and setting its values is a manual ops step, documented in `environment-variables.md`, not part of this issue.

Delivered as a single PR covering all of the above (same shape as #302).

### Verification
- Backend Jest (strategy, flow service, config, controller e2e) with the fake GitHub client and a test-only RSA key; frontend Jasmine; proxy PHPUnit if a middleware changes — covering the spec's *Required tests* list.
- Lint and coverage pass inside docker-compose.
- `security` reviews the install/connect/select claim flow; `data-access` reviews the new endpoints and response fields.
- The spec's *Manual smoke check (#303)* is run in dev with a throwaway GitHub App.

## Benefits
- Organization-friendly, per-repository access to private repos with no long-lived token at rest.
- Completes the three integration types planned under #295.
