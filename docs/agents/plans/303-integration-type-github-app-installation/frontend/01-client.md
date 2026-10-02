# Client methods
Add `startGithubApp({ label | integrationId, mode })`, `completeGithubApp({ code, state,
installationId?, setupAction? })` and `selectGithubAppInstallation({ state, installationId })`
posting to the three routes.

## Files to Change
- `frontend/assets/js/client/IntegrationsClient.js` — three methods.
- `frontend/specs/assets/js/client/IntegrationsClientSpec.js` — specs.
