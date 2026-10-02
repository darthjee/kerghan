# Add form modes and handlers
When the type definition has `modes`, render *Install on GitHub* and *Connect existing
installation* (with its hint) instead of the single *Continue to GitHub*; add mode-aware handlers
`onSubmitAddMode(mode)` and `onReconnectMode(uuid, mode)`.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/helpers/CredentialFormHelper.jsx` — mode buttons.
- `frontend/assets/js/components/resources/accounts/pages/integrations/IntegrationsHandlers.js` — new handlers.
- `frontend/specs/support/taggedHandlers.js` — `HANDLER_NAMES`.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/CredentialFormHelperSpec.js`, `frontend/specs/assets/js/components/resources/accounts/pages/integrations/IntegrationsHandlersSpec.js`.
