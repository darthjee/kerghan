# Auth module: JWT/refresh-token flow and `user.registered` event

Wire up the actual stateless-JWT authentication flow the issue specifies, plus the Auth module's
one outbound event.

- Access token: JWT (`@nestjs/jwt`), 15 min expiry, issued on login/register/refresh, set as an
  httpOnly + secure cookie (`cookie-parser`/`res.cookie`) — never returned in the response body.
- Refresh token: 7-day expiry, returned in the response body, persisted (hashed) via
  `refresh-token.entity.ts`, rotated on every use (`POST /auth/refresh` issues a new refresh
  token and invalidates the old one — verify the old row is deleted/marked used, not just
  overwritten, to prevent replay).
- `POST /auth/logout` invalidates the current session/refresh token server-side.
- JWT secret is injected via `ConfigService` (env var `KERGHAN_SECRET_KEY`, same var name the
  current Express app already uses) — never read directly by any class, per
  `docs/agents/contributing.md`'s DI rule.
- `backend/src/auth/events/user-registered.event.ts` — event payload class; `auth.service.ts`
  fires it (`@nestjs/event-emitter`'s `EventEmitter2`) on successful registration, following the
  `<entity>.<action>` naming convention (`user.registered`). No listener exists yet in this issue
  (out of scope: no other module consumes it yet) — the event only needs to fire correctly and be
  covered by a test asserting it was emitted with the right payload.

## Files to Change

- `backend/src/auth/auth.service.ts` — add JWT issuance, refresh rotation, logout, event
  emission
- `backend/src/auth/events/user-registered.event.ts` — new
- `backend/src/main.ts` — register `cookie-parser` middleware if not already added in
  [Step 01](01-bootstrap-nestjs-skeleton.md)
