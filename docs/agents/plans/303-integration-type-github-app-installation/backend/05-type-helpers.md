# Credential, metadata and URL helpers
Mirror `oauth-app-credential.ts` / `oauth-app-metadata.ts`:
- Secret payload `{ installationId }` only, validated on decrypt (bad shape → `undecryptable`).
- `mask`: `installation …` + last 4 digits.
- Metadata: exactly the spec's keys with its validation rules (`accountLogin`/`verifiedBy`
  `[A-Za-z0-9-]{1,39}`; a GitHub answer failing them maps to `GITHUB_UNAVAILABLE`).
- Redirect URLs: install `https://github.com/apps/<slug>/installations/new?state=…`; connect
  `https://github.com/login/oauth/authorize?client_id&redirect_uri&state&allow_signup=false&prompt=select_account`
  (no scope, no PKCE).

## Files to Change
- `backend/src/integrations/types/github-app/github-app-credential.ts` — new.
- `backend/src/integrations/types/github-app/github-app-metadata.ts` — new.
- `backend/src/integrations/types/github-app/github-app-urls.ts` — new.
- matching specs under `backend/src/integrations/tests/`.
