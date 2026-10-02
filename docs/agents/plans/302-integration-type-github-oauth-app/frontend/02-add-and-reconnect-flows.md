# Add and reconnect flows

**Add form:** for a type with `flow: 'redirect'`, `CredentialFormHelper` renders only *Label*,
the type's warnings and a *Continue to GitHub* submit button, with no credential inputs.

**Controller:** a new `IntegrationsController#startRedirect({ label } | { integrationId })`:

1. Calls `client.startOauthApp`.
2. Checks that `authorizeUrl` starts with `https://github.com/login/oauth/authorize?`.
3. If it does, calls an injected `navigate(url)` (default `window.location.assign`). Otherwise
   it shows an error and doesn't navigate.
4. On an API error, it shows the mapped message on the form (create) or on the row (reconnect).

`create` dispatches to `startRedirect` for redirect types. The existing paste path is unchanged.

**Row actions:**

- For `oauth_app` rows, `IntegrationActionsHelper` renders *Reconnect with GitHub* in place of
  *Replace credential*, with the same highlight rules. It calls `startRedirect({ integrationId })`
  with no form.
- When `oauth_app` isn't in the enabled `types`, the button is hidden and the row shows "The
  OAuth App is disabled on this server." The helper needs the enabled types passed in; they're
  already in page state.
- The Remove confirmation uses the type's `removeReminder`.
- The row shows "no expiry" for `expiresAt: null`, if `formatters.js` doesn't already.

Specs:

- the redirect form has no credential field and shows the warnings;
- submitting calls `startOauthApp` and navigates;
- a non-GitHub `authorizeUrl` isn't followed and shows an error;
- *Reconnect* calls start with `integrationId`;
- *Reconnect* is hidden when the type is disabled;
- the Remove confirmation text;
- API errors are mapped.

## Files to Change

- `frontend/assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js` — `startRedirect` and the injected `navigate`.
- `frontend/assets/js/components/resources/accounts/pages/helpers/CredentialFormHelper.jsx` — the redirect-flow form.
- `frontend/assets/js/components/resources/accounts/pages/helpers/IntegrationActionsHelper.jsx` — *Reconnect with GitHub*, the disabled note and the remove reminder.
- `frontend/assets/js/components/resources/accounts/pages/integrations/IntegrationsHandlers.js` — handlers for continue and reconnect.
- `frontend/assets/js/components/resources/accounts/pages/helpers/IntegrationsHelper.jsx` / `IntegrationsTableHelper.jsx` — pass the enabled types to the row actions, if needed.
- `frontend/specs/…` — matching specs.
