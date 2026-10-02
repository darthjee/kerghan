# Infra Plan: Integration type: GitHub OAuth App

Main plan: [plan.md](plan.md)

## Shared contracts

What infra **documents** (read by the backend at boot):

- `KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` (optional): `1–100` characters of `[A-Za-z0-9._-]`.
- `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET` (optional, secret).
- Both unset → the `oauth_app` type is disabled. Only one set → boot fails.
- When enabled: `FRONTEND_BASE_URL` is required, and must be `https` in production. The callback
  URL is its origin + `/integrations/oauth_app/callback`.

## Implementation Steps

### Step 1 — Sample env and environment-variables docs

- **`.env.dev.sample`:** add both variables **commented out**, with a short comment.
  - The type is disabled by default.
  - To try it, register a personal OAuth App whose *Authorization callback URL* is
    `http://localhost:3000/integrations/oauth_app/callback` (Tent's port), then set both
    variables.
- **`docs/agents/environment-variables.md`:**
  - document both variables: optional, the disabled behaviour, the boot failures, the secret's
    handling rules, and the derived callback URL;
  - add a per-environment table:
    - Dev: disabled by default, personal app;
    - CI: unset, so disabled;
    - Production: its own OAuth App with the public host's callback URL, and both variables set
      as backend host env vars.
- **No changes needed** to `docker-compose.yml` (`env_file: .env` already passes them), CI
  (the type stays disabled), or the deploy scripts. Enabling the type in production is out of
  scope.

## Files to Change

- `.env.dev.sample` — the commented variables.
- `docs/agents/environment-variables.md` — both variables and the per-environment setup.

## CI Checks

- Markdown lint on the docs, using the repo's usual markdownlint invocation (inside
  docker-compose).
