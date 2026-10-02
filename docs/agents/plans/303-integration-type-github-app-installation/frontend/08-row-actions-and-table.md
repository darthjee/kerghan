# Row actions, table details and disabled type
*Reconnect* on a github_app row offers both modes. When the type is disabled, github_app rows show
*Test* and *Reconnect* disabled with "The GitHub App is disabled on this server." (oauth_app
unchanged). Remove confirmation uses the spec's text naming the account. Table shows account login
+ type and "all repositories"/"selected repositories"; confirm expiry shows "no expiry" for
`null`. Split `IntegrationActionsHelper.jsx` (e.g. a `RowButtonsHelper`) to stay under 300 lines.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/helpers/IntegrationActionsHelper.jsx` — disabled buttons, mode-aware reconnect, remove text.
- `frontend/assets/js/components/resources/accounts/pages/helpers/RowButtonsHelper.jsx` — new, if split.
- `frontend/assets/js/components/resources/accounts/pages/helpers/IntegrationsTableHelper.jsx` — github_app details.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/IntegrationActionsHelperSpec.js`, `frontend/specs/assets/js/components/resources/accounts/pages/helpers/IntegrationsTableHelperSpec.js`.
