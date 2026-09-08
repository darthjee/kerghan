# Environment variable docs

Document the new optional TTL variable in the same table `KERGHAN_ACCESS_TOKEN_TTL_MS` already
lives in, following that row's shape (`Status` = "**Consumed**, optional", default noted, `Source`
pointing at the new service file).

## Files to Change

- `docs/agents/environment-variables.md` — add a `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` row to the
  "Backend application runtime" table: optional, defaults to `3600000` (1 hour), source
  `backend/src/auth/authorization-request.service.ts`.
