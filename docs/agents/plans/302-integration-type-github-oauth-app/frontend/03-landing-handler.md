# Landing handler

The SPA boots at `/integrations/oauth_app/callback?…` (served by Tent). It must clean the URL
before **any** request, and `App` may make requests on mount, so handle the landing in
`main.jsx` **before** `renderApplication`.

**`utils/oauth/OauthAppLanding.js`:**

- `capture(location, history)`:
  1. If `location.pathname` isn't `/integrations/oauth_app/callback`, return.
  2. Read `code`, `state` and `error` from `location.search`.
  3. Immediately call `history.replaceState(null, '', '/#/account/integrations')`.
  4. Keep the result **in module memory only**, never in storage:
     - `error=access_denied` → `{ kind: 'cancelled' }`;
     - any other `error`, or a missing `code` or `state` → `{ kind: 'failed' }`;
     - otherwise → `{ kind: 'callback', code, state }`.
- `take()`: returns the pending result once and clears it, so `code` and `state` don't outlive
  the single request.

**Integrations page:** `IntegrationsController.load()` (or the page effect) first does
`OauthAppLanding.take()`:

- `cancelled` → the banner "You cancelled the GitHub authorization."; no call.
- `failed` → "GitHub didn't complete the authorization. Try again."; no call.
- `callback` → `client.completeOauthApp({ code, state })`.
  - On success, insert or replace the row, and show "Connected to GitHub as `<login>`".
  - On failure, show the mapped error (including `INTEGRATION_REDIRECT_STATE_INVALID`).

Then the usual list load runs, so the list is fresh. Add a page-level notice slot (success or
error) to `IntegrationsHelper` if none exists.

A logged-out user gets the usual `ApiClient` login-modal flow. The flow has to be started again
after logging in (no retry with the captured code).

Specs:

- `replaceState` is called before any client call, and for every outcome;
- `access_denied`, other errors and missing values make no call;
- `take()` returns the result once;
- the success and error texts render;
- canary `code` and `state` never reach `console`, `localStorage`, `sessionStorage` or the URL;
- a non-callback path is a no-op.

## Files to Change

- `frontend/assets/js/utils/oauth/OauthAppLanding.js` — new.
- `frontend/assets/js/main.jsx` — call `OauthAppLanding.capture(window.location, window.history)` before rendering.
- `frontend/assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js` — consume the pending landing result.
- `frontend/assets/js/components/resources/accounts/pages/helpers/IntegrationsHelper.jsx` — the page-level notice.
- `frontend/specs/…` — matching specs.
