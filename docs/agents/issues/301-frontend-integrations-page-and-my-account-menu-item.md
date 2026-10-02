# Issue: Frontend: Integrations page and My account menu item

## Context
Part of #295 (GitHub integrations). A user can register one or more **integrations**: GitHub credentials that Kerghan's backend (never the browser) will later use to talk to GitHub on their behalf. Each integration has a `provider` (`github`) and a `type`: `pat` (Personal Access Token), `oauth_app` (GitHub OAuth App) or `github_app` (GitHub App installation). The backend API was delivered by #300. Moving issue fetching to a backend proxy is out of scope for #295.

## Description
Build the frontend Integrations page, and add an *Integrations* item to the "My account" dropdown. The page consumes the `integrations` API from #300 and follows the specs, which are the source of truth:
- `docs/agents/specs/integrations/ui.md`: menu item, page states, list columns, actions, type picker, credential input rules, required tests.
- `docs/agents/specs/integrations/api.md`: routes, response shape, error codes.
- `docs/agents/specs/integrations/types/pat.md` (*UI guidance*): the PAT create, replace and remove texts.

## Problem
The backend can store and test integrations, but users have no way to reach them. There is no menu entry, page or client for the integrations API.

## Expected Behavior
- A logged-in user sees *Integrations* in the "My account" dropdown. It links to `#/account/integrations`.
- The page loads the user's integrations (`POST /integrations/mine.json`) and shows loading, empty and error (with retry) states.
- Each row shows label, type, GitHub account (with a shared-login hint), status badge and reason, masked credential hint, expiry (with an *expiring soon* flag within 7 days), and last test.
- The user can add a PAT, rename, replace the credential, remove (with confirmation), and test the connection. Each action shows API errors with friendly text for the known codes, and no stale status remains after it.
- The *Test* button is disabled during the cooldown (until `nextTestAt`), and after a 429 for the `Retry-After` seconds.

## Solution
- **Header:** add an *Integrations* item to the "My account" dropdown (`HeaderHelper`), next to *Authorizations* and *Account*.
- **Route and page:** a new `#/account/integrations` hash route and page, following the existing `resources/accounts/pages` structure (page + controller + helper).
- **Rename:** inline or modal, whichever fits the existing frontend patterns better (the spec allows either).
- **Add flow:** a type picker fed by `POST /integrations/types.json`, intersected with the types the frontend implements. Only PAT is implemented here: a form with *Label* and *Token*. OAuth App and GitHub App add their flows in their own sub-issues, so the picker and the per-type forms must be pluggable.
- **Client:** an `IntegrationsClient` in `client/`, following the existing client patterns (`ApiClient.postJson`/`patchJson`/`deleteJson`).
- **Backend: `nextTestAt`:** the cooldown (`KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS`) is backend config the frontend can't see. Add `nextTestAt` to every Integration response: `lastTestedAt` + cooldown as an ISO-8601 string, or `null` when never tested. Update `api.md` (response shape) and `ui.md` (cooldown rule), with backend specs for the field. The data-access agent reviews the new response field.
- **Retry-After:** `ApiClient`/`ApiError` don't expose response headers today. Extend them so a 429 carries `Retry-After` (seconds) to the caller.
- **Credential safety:** follow the spec's credential input rules (password input, `autocomplete="off"`, cleared after every submit, never in `console`, storage or the URL).

## Verification
- Jasmine specs for the page, controllers, helpers and client, covering the *Required tests* list in `ui.md`, including the canary test.
- `yarn lint` and coverage pass inside docker-compose.
- Manual check in the running app: add a PAT, test it, rename it, replace it, and remove it.

## Benefits
- Users can manage their GitHub credentials, unblocking the later type sub-issues and the move of GitHub calls to the backend.
