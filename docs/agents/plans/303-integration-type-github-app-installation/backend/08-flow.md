# Cool-off attempt wrapper and flow services
Extract a generic `attempt<T>(userId, fn)` from `IntegrationCredentialService.validate`
(reserve an attempt; on a domain error keep it only if `countsTowardCoolOff`; on success reset) and
make `validate` use it. Decision: a callback that ends in a **selection** settles its attempt
without resetting (no failure counted, no reset); only a stored integration resets.

Flow services (split to stay under 300 lines), with the spec's check order exactly:
- start: disabled → 404 (guard), validation, replace owner lookup / type check, cool-off 423,
  create cap/label 409, issue `redirect` state, return `{ redirectUrl }`. No GitHub call, never
  counted.
- callback: consume `redirect` state, replace re-lookup, cool-off, cap/label, then inside
  `attempt`: user verification → pick installation (claimed id must be in the list; connect: 0 →
  422, 1 → it, >1 → issue `select` state and return the selection sorted case-insensitively,
  deduplicated, ≤100) → installation checks → store (create 201 via `insertWithinCap`, replace 200
  via `updateOwned`).
- select: consume `select` state, replace re-lookup, cool-off, cap/label, id not among candidates
  → 422 (counted), then installation checks and store.
Shared create/replace storage goes in a small helper reused by callback and select.

## Files to Change
- `backend/src/integrations/integration-credential.service.ts` — `attempt<T>`.
- `backend/src/integrations/types/github-app/github-app-flow.service.ts` — new (start, callback).
- `backend/src/integrations/types/github-app/github-app-selection.service.ts` — new (selection building + select).
- `backend/src/integrations/types/github-app/github-app-store.ts` — new (create/replace storage helper).
- `backend/src/integrations/tests/github-app-flow.service.spec.ts`, `backend/src/integrations/tests/github-app-selection.service.spec.ts` — new.
- `backend/src/integrations/tests/integration-credential.service.spec.ts` — cover `attempt`.
