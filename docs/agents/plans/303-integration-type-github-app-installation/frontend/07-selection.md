# Installation selection component
A component rendered from `IntegrationsHelper.jsx` when a selection is present: one entry per
installation (`accountLogin` + User/Organization badge + choose button), the "Only the first 100
installations are shown." notice when exactly 100 arrive, and a cancel that clears the selection.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/helpers/GithubAppSelection.jsx` (component) — new.
- `frontend/assets/js/components/resources/accounts/pages/helpers/IntegrationsHelper.jsx` — render it.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/GithubAppSelectionSpec.js` — new; `IntegrationsHelperSpec.js`, `IntegrationsHelperCanarySpec.js`.
