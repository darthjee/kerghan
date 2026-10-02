# Issue: Integration type: GitHub OAuth App

## Description
Part of #295 (GitHub integrations). A user can register one or more **integrations**: GitHub credentials that Kerghan's backend (never the browser) uses to talk to GitHub on their behalf. Each has a `provider` (`github`) and a `type`: `pat`, `oauth_app` or `github_app`.

This issue implements the **`oauth_app`** type end to end (backend, frontend, proxy, docs), exactly as defined in [`docs/agents/specs/integrations/types/oauth-app.md`](../specs/integrations/types/oauth-app.md). That spec is the source of truth; this issue only scopes the work. It builds on the generic `integrations` module and `pat` type from #300 and the Integrations page from #301.

## Problem
- Users can only add integrations by pasting a Personal Access Token. There is no way to connect a GitHub account through a consent screen.
- `oauth_app` is already fixed in the specs and in the type enum, but no strategy, routes or UI exist for it.
- The type is redirect-based, so it needs pieces the PAT type didn't: a server-side `state` with PKCE, a landing route that Tent must serve without rewriting it into the hash, and token revocation.

## Expected Behavior
- When the server has an OAuth App configured, the type picker offers **OAuth App**. The user gives a label, clicks *Continue to GitHub*, approves the `repo` scope, and lands back on the Integrations page with a new `active` row (`gho_…` hint, GitHub login, `repo` scope, no expiry).
- `oauth_app` rows offer *Reconnect with GitHub* (replace credential through the same flow). The previous token is revoked best-effort.
- Deleting an `oauth_app` row revokes **only that token** on GitHub, best-effort. Other connections of the same GitHub account keep working.
- Cancelling on GitHub, an expired or replayed `state`, and GitHub errors each show the spec's error text and store nothing.
- Without the client id and secret, the type is **disabled**: hidden from the picker, the type routes answer 404, and existing rows can still be renamed, tested and deleted.
- `code`, `state`, the token and the client secret never reach logs, error bodies, responses, browser storage or the URL after landing.

## Solution
Implement everything in `types/oauth-app.md`. The main pieces by owner:

### Backend
- `oauth_app` strategy registered in the type registry: `flows: { credentialPaste: false, redirect: true }`, `isEnabled` from server config, `validate` (code exchange with PKCE + `GET /user` scope check), `test`, `describeMetadata` (`scopes`, `clientId`), `mask` (`gho_…` + last 4), and `onDelete` (revocation).
- `POST /integrations/oauth_app/start.json` and `POST /integrations/oauth_app/callback.json`: checks in the spec's order, behind `JwtGuard` and `OriginGuard`, cache class `never`. Thin controller, logic in the service.
- `integrations_oauth_states` table + migration (with a working `down`): single-use, user-bound, hashed-secret, 10-minute `state`, at most 5 pending per user, purged on start.
- Revocation through the shared GitHub client (`DELETE /applications/{client_id}/token`, never the grant endpoint): on delete, on replace (old token) and on any failure after a successful exchange (new token).
- Generic create and replace credential with `oauth_app` answer 400 `INTEGRATION_FLOW_UNSUPPORTED`.
- Server config read once at boot via DI: `KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` and `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET`. The callback URL is derived from `FRONTEND_BASE_URL`'s origin, and boot fails per the spec's rules.
- There is **no refresh logic**: OAuth App tokens don't expire (`expiresAt` is always `null`).
- Re-check GitHub's endpoints, parameters and headers against GitHub's current docs while implementing.

### Frontend
- An `oauth_app` type module next to `types/pat.js`: the picker description, a create form with only *Label* and *Continue to GitHub*, and *Reconnect with GitHub* on `oauth_app` rows (hidden when the type is disabled).
- Warnings before continuing: `repo` grants write access, organizations may need to approve the app, and GitHub keeps at most 10 authorizations per account.
- Landing handler for `/integrations/oauth_app/callback`: reads `code`/`state`/`error`, calls `history.replaceState` to `/#/account/integrations` **before any request**, then posts the callback or shows the cancel/error text.
- `authorizeUrl` is followed only if it starts with `https://github.com/login/oauth/authorize?`.
- Error texts for `INTEGRATION_REDIRECT_STATE_INVALID` and the `revoked` reason. The Remove confirmation mentions revocation.

### Proxy (Tent)
- A dedicated rule in both `dev_configuration` and `prod_configuration` serving the SPA for `GET /integrations/oauth_app/callback` (with any query string), winning over `backend.php`/`redirects.php`.
- Responses carry `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, via an extended or new middleware in `proxy/extension/` with PHPUnit specs.
- Confirm that SPA assets load from the nested path in dev and prod.
- The two backend routes need no new rule (they end in `.json`).

### Infra and docs
- Commented entries for both variables in `.env.dev.sample`. There is no docker-compose change (`env_file: .env` already passes them through) and no CI change (the type stays disabled in CI).
- `docs/agents/environment-variables.md`: both variables and the per-environment OAuth App setup (dev callback on Tent's port 3000, production on the public host).

### Cache
- Both routes are cache class `never` and send `X-Skip-Cache`. Navi must not warm them; the cache agent confirms this.

### Verification
- Every spec in the *Required tests* section of `oauth-app.md`: backend Jest with the fake GitHub client and canary values, frontend Jasmine, and proxy PHPUnit.
- Lint and coverage pass inside docker-compose.
- The security and data-access agents review the flow and have no open objection.
- The spec's *Manual smoke check* is **not** a merge requirement. The owner runs it after merge with a throwaway OAuth App, so the PR links to that section as a post-merge step.

### Out of scope
- Moving issue fetching to the backend (#295 non-goal).
- The GitHub App type (#303) and key rotation (#305).
- Enabling the type in production: registering the production OAuth App and setting its two env vars on the host is a manual ops step for the owner. #302 ships the type disabled unless configured, with the setup documented.

## Benefits
- Users connect GitHub by approving a consent screen instead of creating and pasting a token.
- Tokens are revocable per integration, and unused ones are never left valid.
- It proves the redirect-flow path (`state`, PKCE, landing rule) that #303 (GitHub App) reuses.
