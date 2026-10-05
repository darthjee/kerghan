# Documentation
- `docs/agents/backend/routes/auth.md`: add sections for `POST /auth/sessions/mine.json`, `POST /auth/sessions/:uuid/revoke.json` and `POST /auth/sessions/revoke-others.json`, covering auth requirement, body, response shape, status codes (404 for an unknown or foreign uuid, 401 for an invalid current token on revoke-others, with the `ApiClient` refresh-and-retry note) and `CacheClass.Never`. Add `session.controller.ts`/`session.service.ts` to "Source files".
- `docs/agents/modules/auth.md`: document `session_uuid`/`started_at` on `auth_refresh_tokens` (minted at login, carried on rotation, backfilled one session per existing row) and the new `SessionService`/`SessionController`.

## Files to Change
- `docs/agents/backend/routes/auth.md`: the new routes.
- `docs/agents/modules/auth.md`: the schema and service notes.
