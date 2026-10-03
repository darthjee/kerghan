# Frontend Plan: Cleanup: remove integrations specs and fold into permanent docs

Main plan: [plan.md](plan.md)

## Shared contracts

Use the old → new reference mapping table in [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Repoint spec citations in comments

Rewrite every `docs/agents/specs/integrations/...` citation in JSDoc and comments to the new
path and anchor. Do not change code or behavior. To find every citation, run
`git grep -n "specs/integrations" -- frontend`.

### Step 2 — Lint

Run frontend lint through docker-compose (never on the host): `docker-compose run --rm kerghan_fe yarn lint`.

## Files to Change
- `frontend/assets/js/client/IntegrationsClient.js`
- `frontend/assets/js/utils/oauth/OauthAppLanding.js`, `GithubAppLanding.js`
- `frontend/assets/js/components/resources/accounts/pages/helpers/GithubAppSelection.jsx`
- `frontend/assets/js/components/resources/accounts/pages/integrations/githubAppFlow.js`
- `frontend/assets/js/components/resources/accounts/pages/integrations/types/pat.js`,
  `oauthApp.js`, `githubApp.js`

## CI Checks
- `frontend`: `yarn lint` (CI job: `frontend-checks`)
