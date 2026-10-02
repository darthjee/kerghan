# Infra Plan: Integration type: GitHub App installation

Main plan: [plan.md](plan.md)

## Shared contracts

- Five backend env vars, all-or-nothing (unset → type disabled; partial/malformed → boot fails):
  `KERGHAN_GITHUB_APP_ID`, `KERGHAN_GITHUB_APP_SLUG`, `KERGHAN_GITHUB_APP_PRIVATE_KEY` (one-line
  base64 of the PEM), `KERGHAN_GITHUB_APP_CLIENT_ID`, `KERGHAN_GITHUB_APP_CLIENT_SECRET`.
- Read by `backend/src/integrations/types/github-app/github-app-config.ts`.
- Callback URL = origin of `FRONTEND_BASE_URL` + `/integrations/github_app/callback`.

## Implementation Steps

### Step 1 — `.env.dev.sample`
Add a commented block right after the OAuth App one: disabled by default; to try it, register a
personal throwaway GitHub App (callback `http://localhost:3000/integrations/github_app/callback`,
*Request user authorization (OAuth) during installation* on, webhook inactive, Issues: read and
Metadata: read) and set all five; setting only some fails boot. Include how to produce the one-line
key: `base64 -w0 key.pem` (GNU) / `base64 -i key.pem` (macOS), unquoted value.

### Step 2 — `docs/agents/environment-variables.md`
- Five rows in the variables table next to `KERGHAN_GITHUB_OAUTH_APP_*`.
- Extend the `NODE_ENV` / `FRONTEND_BASE_URL` rows with the github_app https/callback rule.
- New subsection "Setting up the GitHub App" after the OAuth App one: boot rules, derived callback
  URL, Dev/CI/Production table, GitHub app settings (spec *Server config*), base64 key gotchas
  (single line, unquoted, PKCS#1 `BEGIN RSA PRIVATE KEY` accepted, never paste the raw PEM in
  Render), and that production registration + Render values are a manual ops step.
- Extend the "GitHub credentials — integrations only" paragraph to cover the app id/key/secret.

## Files to Change
- `.env.dev.sample` — commented GitHub App block.
- `docs/agents/environment-variables.md` — rows, subsection, credential paragraph.

## Notes
- **No `docker-compose.yml`, CI or deploy-script change:** compose's `env_file: .env` /
  `.env.prod` already passes the variables; production runs on Render, where vars are set in the
  dashboard; CI leaves them unset (type disabled). State this in the doc, as #302 did.
