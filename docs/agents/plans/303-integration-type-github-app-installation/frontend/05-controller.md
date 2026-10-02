# Controller and page state
Dispatch redirect starts by type through a `Map` of type → flow; complete both landings in
`load()`; add `selectInstallation(installationId)` and a `setSelection` setter; add the
`selection` state to the page. Keep the controller under 300 lines by delegating to the flow
modules.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js` — dispatch, selection.
- `frontend/assets/js/components/resources/accounts/pages/Integrations.jsx` — selection state.
- `frontend/specs/support/integrationsControllerHarness.js` — `setSelection`.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/IntegrationsControllerGithubAppSpec.js` — new; `IntegrationsSpec.js`; extend `IntegrationsControllerCanarySpec.js` with the selection `state`.
