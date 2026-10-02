# Integrations page controller
Add `Integrations.jsx` (page) plus `controllers/IntegrationsController.js` under `components/resources/accounts/pages/`, mirroring `AuthorizationRequests` + `AuthorizationRequestsController`: React state setters injected into the controller, a client override for tests, and an exported `buildLoadEffect`.

Controller responsibilities:
- `load()`: loads integrations and enabled types (`listMine` + `listTypes`), with loading, empty and error states and a retry.
- Actions `create`, `rename`, `replaceCredential`, `remove` and `test`. On success, update the affected row from the response (or drop it after remove), so no stale status remains. On failure, store a per-row (or per-form) error from the `ApiError`, mapped to friendly text for known codes: `INTEGRATION_LABEL_TAKEN`, `INTEGRATIONS_LIMIT_REACHED`, `INTEGRATION_CREDENTIAL_LOCKED`, `INTEGRATION_CREDENTIAL_INVALID`, `INTEGRATION_INSUFFICIENT_PERMISSIONS`, `INTEGRATION_TEST_COOLDOWN`, `GITHUB_UNAVAILABLE`, `GITHUB_RATE_LIMITED`, `VALIDATION_FAILED`. Fall back to the API message.
- A `undefined` client result (session expired) returns without touching state, as in `AuthorizationRequestsController`.
- **Credential clearing:** the credential field in the form state is cleared after every submit, on success and on failure. It's never passed to `console`, storage or the URL.
- **Cooldown:** a row's *Test* is disabled while `nextTestAt` is in the future, or, after a 429, until `now + retryAfter` seconds. Schedule a re-render when the cooldown ends (one timer per row, cleared on unmount), so the button re-enables on its own.
- **Add flow:** the type picker offers `types.json` types intersected with the frontend's implemented types (only `pat` for now). Keep the implemented types in a small registry module (e.g. `integrations/types/index.js`, `pat` → form spec and texts), so later types plug in.

Specs: controller specs for load (success, empty, error, retry), every action's success and error paths, credential clearing on success and failure, the cooldown (from `nextTestAt` and from a 429 `Retry-After`, plus re-enable after it), and the type intersection.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/Integrations.jsx`: page component.
- `frontend/assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js`: controller.
- A small integration-types registry module (location at the implementer's discretion, near the page).
- Matching specs under `frontend/specs/assets/js/components/resources/accounts/pages/`.
