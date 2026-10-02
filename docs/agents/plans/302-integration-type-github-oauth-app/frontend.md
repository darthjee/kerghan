# Frontend Plan: Integration type: GitHub OAuth App

Main plan: [plan.md](plan.md)

## Shared contracts

What frontend **relies on** (produced by backend and proxy):

- **`POST /integrations/oauth_app/start.json`:** body `{ label }` or `{ integrationId }` →
  `200 { authorizeUrl }`.
- **`POST /integrations/oauth_app/callback.json`:** body `{ code, state }` → `201` or `200`
  `Integration`.
- **`types.json`:** lists `oauth_app` (`flows.redirect: true`) only when enabled. When it's
  absent, hide the type from the picker and hide *Reconnect* on existing `oauth_app` rows (show
  "The OAuth App is disabled on this server.").
- **Error codes:** the generic mapping already exists in `errorMessages.js`. Add
  `INTEGRATION_REDIRECT_STATE_INVALID` → "This GitHub authorization link expired or was already
  used. Start again."
- **`oauth_app` rows:** `secretHint` `gho_…XXXX`, `expiresAt: null` (shown as "no expiry"),
  `metadata.scopes`, and the `statusReason` `revoked`.
- **Landing:** Tent serves `index.html` at `/integrations/oauth_app/callback?…`. The frontend
  must call `history.replaceState(null, '', '/#/account/integrations')` **before any request**.

## Steps

- [01 — Client methods and the `oauth_app` type module](frontend/01-client-and-type-module.md)
- [02 — Add and reconnect flows](frontend/02-add-and-reconnect-flows.md)
- [03 — Landing handler](frontend/03-landing-handler.md)

## CI Checks

- `frontend/`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend/`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- `code` and `state` must never reach `console`, `localStorage`/`sessionStorage`, React state
  beyond the single callback request, or the URL after `replaceState`. Specs use canary values to
  assert this.
- Navigate with `window.location.assign`, injected (as the controller already does with its
  client) so specs don't navigate. Follow `authorizeUrl` only if it starts with
  `https://github.com/login/oauth/authorize?`; otherwise show an error.
- Keep the existing helper/controller split (`*Helper.jsx` renders, `*Controller.js` holds
  logic, `IntegrationsHandlers.js` wires events).
