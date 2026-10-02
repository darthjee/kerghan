# Verification, installation and revocation services
- `GithubAppUserVerificationService`: code exchange (expects a `ghu_` token;
  `bad_verification_code` → `CredentialInvalidError`; other `error` or bad answer → 502, logged
  with GitHub's error code only), `GET /user` login (`verifiedBy`), installations up to 10 pages
  filtered by `app_id` (warn when truncated), and **always** revoke the user token best-effort in
  a `finally` (warn log with safe fields only). Refresh token dropped.
- `GithubAppInstallationService`: installation checks with the app JWT (`GET
  /app/installations/{id}`, app id match, permissions, suspended) + token-mint proof; one mapping
  for create/select (errors per the spec's *Validate / create* table, rate limit taking precedence
  over 403) and one for test (outcomes per the *Test connection* table).
- `GithubAppRevocationService`: `revokeOauthToken` with the GitHub App's client id/secret.

## Files to Change
- `backend/src/integrations/types/github-app/github-app-user-verification.service.ts` — new.
- `backend/src/integrations/types/github-app/github-app-installation.service.ts` — new.
- `backend/src/integrations/types/github-app/github-app-revocation.service.ts` — new.
- matching specs under `backend/src/integrations/tests/`.
