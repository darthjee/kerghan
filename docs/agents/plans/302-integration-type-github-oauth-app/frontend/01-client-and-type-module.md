# Client methods and the `oauth_app` type module

**`IntegrationsClient`:**

- `startOauthApp({ label } | { integrationId })` → `postJson('/integrations/oauth_app/start.json', body)`.
- `completeOauthApp({ code, state })` → `postJson('/integrations/oauth_app/callback.json', body)`.

Both keep the client's contract: `undefined` on an expired session, `ApiError` otherwise.

**`types/oauthApp.js`**, registered in `types/index.js` next to `PatType`. It defines:

- `type: 'oauth_app'` and `name: 'OAuth App'`;
- a `flow: 'redirect'` marker. Add `flow: 'paste'` to `PatType` so helpers branch on the flow,
  never on the type name;
- `description`: "Connect a GitHub account by authorizing Kerghan's OAuth App.";
- `warnings`, shown before continuing:
  - `repo` grants write access to every repository you can reach;
  - organizations may need to approve the app before their private repositories are visible;
  - GitHub keeps at most 10 authorizations of the app per account, so connecting the same
    account more than 10 times revokes the oldest one;
- `removeReminder`: Kerghan will also try to revoke this authorization on GitHub, and other
  connections of the same GitHub account keep working;
- `reasonText`:
  - `revoked` → "GitHub no longer accepts this authorization. It may have been revoked on
    GitHub, unused for a year, or replaced by newer authorizations. Reconnect to fix it.";
  - `insufficient_permissions` → "This authorization lacks the `repo` scope. Reconnect with
    GitHub to grant it.".

Also add `INTEGRATION_REDIRECT_STATE_INVALID` to `errorMessages.js`.

Specs:

- the client methods post to the right paths with the right bodies;
- `IntegrationTypes.available` includes `oauth_app` only when the server lists it;
- the reason texts;
- the new error message.

## Files to Change

- `frontend/assets/js/client/IntegrationsClient.js` — `startOauthApp` and `completeOauthApp`.
- `frontend/assets/js/components/resources/accounts/pages/integrations/types/oauthApp.js` — new type module.
- `frontend/assets/js/components/resources/accounts/pages/integrations/types/pat.js` — add `flow: 'paste'`.
- `frontend/assets/js/components/resources/accounts/pages/integrations/types/index.js` — register `oauth_app`.
- `frontend/assets/js/components/resources/accounts/pages/integrations/errorMessages.js` — the state-invalid text.
- `frontend/specs/…` — matching specs for the client, type registry and error messages.
