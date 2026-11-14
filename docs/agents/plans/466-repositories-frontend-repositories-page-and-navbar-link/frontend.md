# Frontend Plan: Repositories: Frontend — Repositories page and navbar link

Main plan: [plan.md](plan.md)

## Overview
Build the Repositories page from `docs/agents/specs/repos/ui.md` (every section except `#github-handle-field`, done in #465) against the API in `api.md`. It follows the Integrations page structure: page component → controller (state + side effects, with injected setters) → handlers → helpers (pure rendering). Tests follow the three layers of `testing.md#frontend`.

## Context
- Routing: `assets/js/utils/routing/HashRouteResolver.js` (route table) + `assets/js/components/helpers/AppHelper.jsx` (page key → component).
- Navbar: `assets/js/components/common/header/helpers/HeaderHelper.jsx`. `renderAuthLinks` already returns `null` while `pending`, so a link added in its logged-in branch is hidden while awaiting approval for free.
- Client: `assets/js/client/ApiClient.js` (`postJson`, `buildApiError`, `parseRetryAfter`); `ApiError` carries `retryAfter` from the header only.
- The pattern to copy: `accounts/pages/Integrations.jsx`, `controllers/IntegrationsController.js`, `integrations/IntegrationsHandlers.js`, `integrations/CooldownTimers.js`, `helpers/IntegrationsTableHelper.jsx`, and `specs/support/integrationsControllerHarness.js`.
- New feature folder: `assets/js/components/resources/repositories/pages/` (Repositories is a top-level resource, not an account page), with specs mirrored under `specs/assets/js/components/resources/repositories/pages/`.

## Steps

- [01 — Client and retry delay](frontend/01-client-and-retry-delay.md)
- [02 — Route and navbar link](frontend/02-route-and-navbar.md)
- [03 — Repositories controller](frontend/03-controller.md)
- [04 — Page rendering](frontend/04-rendering.md)
- [05 — Docs](frontend/05-docs.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn test` (CI job: `jasmine`, which runs `yarn coverage`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- Never run `yarn`/`npm`/`node` on the host; always go through `docker-compose`.
- The frontend never calls GitHub. Repo links are built as `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}` and are only rendered as `<a>`, never fetched.
- Banner dismissal is in memory only (controller state), never `localStorage`.
- The size limits of the ESLint config (max lines per file/function) will likely force the controller to split into collaborators (e.g. a poller, a countdown, an Add-state store), like Integrations' `CooldownTimers`. That is expected.
- Coverage thresholds stay as they are.
- If the spec turns out wrong or underspecified, fix `docs/agents/specs/repos/` in the same PR and say so in the PR description.
