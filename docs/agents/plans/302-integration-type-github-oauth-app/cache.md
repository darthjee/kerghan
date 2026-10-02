# Cache Plan: Integration type: GitHub OAuth App

Main plan: [plan.md](plan.md)

## Shared contracts

What cache **relies on** (produced by backend and proxy):

- `POST /integrations/oauth_app/start.json` and `POST /integrations/oauth_app/callback.json`
  declare `@CachePolicy(CacheClass.Never)` and send `X-Skip-Cache` and `Cache-Control: no-store`.
- `GET /integrations/oauth_app/callback` (the Tent landing page) is served with
  `Cache-Control: no-store` and no Tent file cache.

## Implementation Steps

### Step 1 — Review cache classes and Navi

Read-only review, after the backend and proxy work:

- **Backend:** both new routes have a cache class, `never` (controller-level `@CachePolicy`),
  and their responses send `X-Skip-Cache`.
- **Navi:** `navi/navi_config.yaml` and `navi/resources/*.yml` don't warm, and must not warm,
  any `integrations/oauth_app/*` route or the landing path. No change is expected. Make one only
  if Navi has a pattern that would pick these routes up.
- **Proxy:** the landing rule uses no file cache and sends `no-store`.

Report any violation to the responsible agent instead of fixing it.

## Files to Change

- None expected. `navi/` changes only if the review finds the new routes would be warmed.

## Notes

- This is the review the issue asks for under *Cache*: the endpoints are never cached.
