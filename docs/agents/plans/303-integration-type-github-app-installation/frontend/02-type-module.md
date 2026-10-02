# Type module, registry and error messages
`githubApp.js`: `{ type: 'github_app', name: 'GitHub App', flow: 'redirect', modes: ['install',
'connect'], description, warnings, removeReminder(integration), reasonText() }` with the spec's
texts (`uninstalled`, `suspended`, overriding `insufficient_permissions`), and a per-type
`INTEGRATION_REDIRECT_STATE_INVALID` override. Make `removeReminder` accept the integration
(function, with a fallback when `githubLogin` is null) while keeping PAT/OAuth strings working.
Register it in `IMPLEMENTED`. Add messages for `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE` and
`INTEGRATION_INSTALLATION_SUSPENDED`.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/integrations/types/githubApp.js` — new.
- `frontend/assets/js/components/resources/accounts/pages/integrations/types/index.js` — register.
- `frontend/assets/js/components/resources/accounts/pages/integrations/errorMessages.js` — new codes, per-type override lookup.
- `frontend/specs/assets/js/components/resources/accounts/pages/integrations/types/githubAppSpec.js` (new), `indexSpec.js`, `errorMessagesSpec.js`.
