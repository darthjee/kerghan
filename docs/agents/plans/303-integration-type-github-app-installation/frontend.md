# Frontend Plan: Integration type: GitHub App installation

Main plan: [plan.md](plan.md)

## Shared contracts

- Consumes the three routes in [plan.md](plan.md#shared-contracts): start answers
  `{ redirectUrl }` (not `authorizeUrl`); callback answers an `Integration` or
  `{ selection: { state, installations[] } }`; select answers an `Integration`.
- No `truncated` flag: show "Only the first 100 installations are shown." when exactly 100 arrive.
- Allow-list before `window.location.assign`:
  `^https://github\.com/apps/[a-z0-9-]+/installations/new\?` or prefix
  `https://github.com/login/oauth/authorize?`.
- Landing at `/integrations/github_app/callback` (Tent serves the SPA there).
- Row shape: `secretHint` `installation …NNNN`, `githubLogin` = account, `expiresAt` null,
  `metadata` keys and reason codes `uninstalled`/`suspended`/`insufficient_permissions`.

## Steps

- [01 — Client methods](frontend/01-client.md)
- [02 — Type module, registry and error messages](frontend/02-type-module.md)
- [03 — Landing capture](frontend/03-landing.md)
- [04 — GitHub App flow module](frontend/04-flow.md)
- [05 — Controller and page state](frontend/05-controller.md)
- [06 — Add form modes and handlers](frontend/06-form-and-handlers.md)
- [07 — Installation selection component](frontend/07-selection.md)
- [08 — Row actions, table details and disabled type](frontend/08-row-actions-and-table.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- UI texts come verbatim from the spec's *Landing*, *`invalid` reason codes*, *Behaviour on delete*
  and *UI guidance* sections.
- 300-line limit: `IntegrationsController.js` (274), `IntegrationActionsHelper.jsx` (266),
  `CredentialFormHelper.jsx` (229) and `IntegrationsControllerSpec.js` (280) are near it — push
  logic into flow modules / new helpers and put new specs in new files.
- The selection `state` lives only in page state until select runs; cleared on success, failure
  and unmount; never put in the URL, console or storage (extend the canary specs).
- `INTEGRATION_REDIRECT_STATE_INVALID` text differs between the OAuth App and GitHub App specs:
  allow a per-type override in the type module instead of changing the OAuth text.
- Disabled type: for `github_app` rows *Test* and *Reconnect* are shown **disabled** with the
  message; leave the existing oauth_app behaviour unchanged.
