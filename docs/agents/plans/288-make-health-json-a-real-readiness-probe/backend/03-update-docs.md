# Update docs and comments
Bring every place that describes `/health.json` in line with the liveness/readiness split.

- `docs/agents/architecture/backend.md`: folder tree (`health/` now has `health.service.ts`; controller serves `/health.json` + `/ready.json`), and the JWT Guard section's list of `@Public()` routes. Add a short note describing the liveness vs. readiness contract (status codes, DB-only check, no error details in the body).
- `docs/agents/architecture/security.md`: the "No state change over `GET`" rule says the only `GET` route is `/health.json` — update to include `/ready.json`, and note it is public and exposes only per-check up/down.
- `docs/agents/architecture/caching.md`: add `GET /ready.json` to the `never` row and mention it in the operational-endpoints bullet.
- `backend/src/core/public.decorator.ts` and `backend/src/core/cache-class.ts`: extend the comment examples that mention `/health.json`/health to cover `/ready.json` where it reads naturally.

## Files to Change
- `docs/agents/architecture/backend.md` — document the health module's two endpoints.
- `docs/agents/architecture/security.md` — list `/ready.json` among `GET`/public routes.
- `docs/agents/architecture/caching.md` — add `/ready.json` to the `never` class.
- `backend/src/core/public.decorator.ts` — comment example.
- `backend/src/core/cache-class.ts` — comment example.
