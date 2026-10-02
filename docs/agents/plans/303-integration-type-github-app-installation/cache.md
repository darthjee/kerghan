# Cache Plan: Integration type: GitHub App installation

Main plan: [plan.md](plan.md)

## Shared contracts

- `POST /integrations/github_app/start.json`, `callback.json`, `select.json` are cache class
  `never` (`@CachePolicy(CacheClass.Never)` at controller level → `X-Skip-Cache`,
  `Cache-Control: no-store`). None is warmed by Navi.

## Implementation Steps

### Step 1 — Review only
After the backend step lands, verify `GithubAppController` declares `@CachePolicy(CacheClass.Never)`
and is listed in `backend/src/core/tests/cache-policy.coverage.spec.ts`, and that nothing under
`navi/` references the new routes. Report violations; make no `navi/` change.

## Files to Change
- None.
