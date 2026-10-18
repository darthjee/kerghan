# Cache Plan: Admin review: approve and deny new users (backend + frontend)

Main plan: [plan.md](plan.md)

## Shared contracts

Reviews the routes in [plan.md](plan.md#shared-contracts): `search.json` (changed),
`approve.json` and `deny.json` (new), all admin-only, user-scoped, `CacheClass.Never`.

## Implementation Steps

### Step 1 — Review Navi resources and cache headers

Confirm none of the changed or new routes belongs in `navi/resources/*.yml` (today only
`clients.yml` exists; admin POST routes are never warmed), and that each declares a cache class
and sends `X-Skip-Cache: true` (inherited from the controller-level
`@CachePolicy(CacheClass.Never)` on `AdminController`). Report violations; expected outcome is
no file change.

## Files to Change

- None expected (`navi/resources/*.yml` only if the review finds a gap).

## Notes

- Read-only review unless a gap is found.
