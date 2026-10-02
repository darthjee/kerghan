# Server config and app JWT
Add the github_app config as a DI factory provider (token Symbol, `Disabled | Enabled` union,
`buildGithubAppConfig(configService)`), mirroring `oauth-app-config.ts`. Read the five variables
once at boot, trimmed: all unset/blank → disabled; all set and valid → enabled; partial or malformed
→ boot fails naming the variables only (never values). Validate id (positive int), slug
(`[a-z0-9-]{1,100}`), client id (`[A-Za-z0-9._-]{1,100}`), private key (base64 → PEM →
`crypto.createPrivateKey`, `asymmetricKeyType === 'rsa'`). Hold key and client secret as
`Secret`s. Callback URL = `FRONTEND_BASE_URL` origin + `/integrations/github_app/callback`,
https required in production. Extract `readTrimmed`/`parseOrigin`/`buildCallbackUrl` from
`oauth-app-config.ts` into a shared helper rather than copying.

App JWT: RS256 via Node `crypto.sign('sha256', …)`, `iat` = now − 60 s, `exp` = now + 9 min,
`iss` = client id (re-check GitHub's current recommendation). Minted per call, never stored or
logged.

## Files to Change
- `backend/src/integrations/types/github-app/github-app-config.ts` — new.
- `backend/src/integrations/types/github-app/github-app-jwt.ts` — new.
- `backend/src/integrations/types/shared/redirect-config.ts` (or similar) — new, extracted helpers.
- `backend/src/integrations/types/oauth-app/oauth-app-config.ts` — use the extracted helpers.
- `backend/src/integrations/tests/github-app-config.spec.ts`, `backend/src/integrations/tests/github-app-jwt.spec.ts` — new (test RSA key from `generateKeyPairSync`).
