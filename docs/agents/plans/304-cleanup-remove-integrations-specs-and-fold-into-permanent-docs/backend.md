# Backend Plan: Cleanup: remove integrations specs and fold into permanent docs

Main plan: [plan.md](plan.md)

## Shared contracts

Use the old → new reference mapping table in [plan.md](plan.md#shared-contracts). Rewrite every
`docs/agents/specs/integrations/...` citation to the matching new path and anchor.

## Implementation Steps

### Step 1 — Repoint spec citations in comments

Update the JSDoc and comment citations only. Do not change code, behavior or tests. Rewrap
comment lines that would go over the ESLint max line length. To find every citation, run
`git grep -n "specs/integrations" -- backend`.

### Step 2 — Lint

Run backend lint through docker-compose (never on the host):
`docker-compose run --rm kerghan_tests yarn lint` (or the backend service from
`docker-compose.yml` that the backend agent normally uses for lint).

## Files to Change
- `backend/src/database/migrations/20261002120011-integrations-create-integrations.ts`
- `backend/src/integrations/integrations.module.ts`, `integrations.controller.ts`,
  `integrations.service.ts`, `integration-enums.ts`, `integration-response.ts`, `secret.ts`,
  `integration-store.service.ts`, `integration-test-cooldown.service.ts`,
  `integration-connection-test.service.ts`, `integration-credential-abuse-guard.service.ts`
- `backend/src/integrations/entities/integration.entity.ts`,
  `integration-oauth-state.entity.ts`, `integration-github-app-state.entity.ts`
- `backend/src/integrations/types/integration-type-strategy.ts`
- `backend/src/integrations/types/pat/pat.strategy.ts`
- `backend/src/integrations/types/oauth-app/*.ts` (strategy, controller, flow,
  code-exchange, revocation, oauth-state services)
- `backend/src/integrations/types/github-app/*.ts` (strategy, controller, flow, state,
  revocation services)

## CI Checks
- `backend`: `yarn lint` (CI job: `backend_checks`)
