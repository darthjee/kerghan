# Server config for the OAuth App

Read the OAuth App config once at boot, following the pattern of `integrations-key.ts`
(`buildIntegrationsKey` + the `INTEGRATIONS_KEY` DI token). Classes never read env vars
directly.

- Add `buildOauthAppConfig(configService)` and the DI token `OAUTH_APP_CONFIG`. It provides
  either `{ enabled: false }` or
  `{ enabled: true, clientId: string, clientSecret: Secret<string>, callbackUrl: string }`.
- Trim both values. Both unset or blank → disabled.
- Throw (failing Nest's boot) in each of these cases:
  - only one of the two is set (name the missing variable);
  - the client id doesn't match `^[A-Za-z0-9._-]{1,100}$`;
  - enabled with `FRONTEND_BASE_URL` unset or unparseable;
  - enabled under `NODE_ENV=production` with a non-`https` origin.

  No error message may contain either value.
- `callbackUrl` = `new URL(FRONTEND_BASE_URL).origin + '/integrations/oauth_app/callback'`.
- Register the provider in `IntegrationsModule`.

Specs (`tests/oauth-app-config.spec.ts`):

- both unset → disabled;
- both set → enabled, with the derived callback URL (a path or query in `FRONTEND_BASE_URL` is
  dropped);
- only one set → throws, naming the missing variable;
- malformed id, missing `FRONTEND_BASE_URL`, and `http` under production → each throws;
- a canary client secret never appears in any error.

## Files to Change

- `backend/src/integrations/types/oauth-app/oauth-app-config.ts` — new: the factory, token and types.
- `backend/src/integrations/integrations.module.ts` — provide `OAUTH_APP_CONFIG`.
- `backend/src/integrations/tests/oauth-app-config.spec.ts` — new.
