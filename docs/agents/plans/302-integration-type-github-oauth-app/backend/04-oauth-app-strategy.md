# `OauthAppStrategy`

Implement `IntegrationTypeStrategy` for `oauth_app`, mirroring the `types/pat/` layout. Register
it in `INTEGRATION_TYPE_STRATEGIES` **after** `pat` (the registry order is the picker order).

- `type = 'oauth_app'` and `flows = { credentialPaste: false, redirect: true }`.
- `isEnabled()` comes from `OAUTH_APP_CONFIG`.
- `parseCredential`: never reached (the generic pipeline rejects types with
  `credentialPaste: false` first). Throw `flowUnsupported()` defensively.
- **`validate(secret)`:** the input `Secret` wraps `{ code, codeVerifier }`, built by the flow
  service.
  1. Call `exchangeOauthCode` and map the answer by the spec's *Validate / create* table:
     - `bad_verification_code` → `CredentialInvalidError`;
     - any other `error`, or no `access_token` starting with `gho_` → `GithubUnavailableError`,
       logged at error level with GitHub's `error` code only;
     - rate limit → `GithubRateLimitedError`.
  2. Call `getUser` with the token:
     - 401 → `CredentialInvalidError`;
     - no `repo` in `X-OAuth-Scopes` → `InsufficientPermissionsError`;
     - rate limit → `GithubRateLimitedError`;
     - other answers, or no usable login → `GithubUnavailableError`.

     Reuse `github-answer.ts` helpers wherever they fit, as `PatStrategy` does.
  3. **Any failure after a token was obtained** revokes that token best-effort before
     rethrowing.
  4. Returns `{ secret: Secret({ token }), githubLogin, expiresAt: null, metadata: { scopes, clientId } }`.
- `parseSecretPayload`: `{ token }`, where `token` is a string starting with `gho_`; anything else
  → `null`.
- `describeMetadata`: exactly the keys `scopes` and `clientId`.
  - `scopes`: sorted and de-duplicated, at most 50 entries of at most 64 characters each.
  - `clientId`: matches `^[A-Za-z0-9._-]{1,100}$`.
  - Anything else → `InvalidMetadataError`.
- `mask`: `gho_` + `…` (U+2026) + the last 4 characters.
- **`test(secret, current)`**, mapping `GET /user`:
  - 200 with `repo` → `active` (refreshed login and metadata, `expiresAt: null`);
  - 200 without `repo` → `invalid` + `insufficient_permissions`;
  - 401 → `invalid` + `revoked`;
  - rate limit → transient `rate_limited` (+ `retryAfterSeconds`);
  - anything else → transient `unavailable`.

  It works while the type is disabled, and never returns `expired`.
- **`revoke(secret, clientIdOfToken?)`**, public, because the flow service uses it too:
  - best-effort `revokeOauthToken`;
  - skipped (and logged) when the type is disabled or `clientIdOfToken` differs from the
    configured id;
  - any failure is logged at warn level with safe fields only and swallowed.
- `onDelete(secret, current)`: `null` secret → no call. Otherwise
  `revoke(secret, current.metadata.clientId)`.

Specs (`tests/oauth-app.strategy.spec.ts`), with the fake GitHub client and canaries:

- every row of the *Validate / create* and *Test connection* tables;
- revocation of the new token on post-exchange failures;
- `describeMetadata` accept and reject cases;
- `mask`;
- `onDelete` calls only `/applications/{client_id}/token`. It makes no call for an
  `undecryptable` row, a disabled type, or a different `clientId`, and a failing revoke doesn't
  throw;
- `test` works while disabled.

## Files to Change

- `backend/src/integrations/types/oauth-app/oauth-app.strategy.ts` — new.
- `backend/src/integrations/types/oauth-app/oauth-app-credential.ts` — new: payload parsing and mask.
- `backend/src/integrations/types/oauth-app/oauth-app-metadata.ts` — new: metadata build and validation.
- `backend/src/integrations/integration-enums.ts` — add the `revoked` reason constant, if reasons are declared there.
- `backend/src/integrations/integrations.module.ts` — provide `OauthAppStrategy` and add it to `INTEGRATION_TYPE_STRATEGIES`.
- `backend/src/integrations/tests/oauth-app.strategy.spec.ts` — new.
- `backend/src/integrations/tests/integration-type-registry.spec.ts` — `enabledTypes()` lists `oauth_app` only when enabled.
