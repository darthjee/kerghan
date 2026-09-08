# Shared auth-response helper and client-request helper

Two small, plain (non-`@Injectable`) helpers — bare file names, no `.helper` suffix, matching the
existing `core/log-context.ts` / `core/access-token-payload.ts` precedent (no file in the backend
uses that suffix today).

## `auth-response.ts`

`AuthController#login`/`#refresh`/`#register` currently build their responses inline via the
private methods `#respond` (`backend/src/auth/auth.controller.ts:168-178` — sets the
`access_token` cookie + `X-Skip-Cache` header, returns `{ user, refreshToken }`) and `#serialize`
(`auth.controller.ts:180-182` — returns `{ id, username, email, isAdmin }`). Extract both into a
shared module so the new device-authorization "logged" response and the password-login response
cannot drift apart.

The extracted function needs a `Response`, an `AuthResult` (`{ user, accessToken, refreshToken }`),
and a `ConfigService` (for the `KERGHAN_ACCESS_TOKEN_TTL_MS` cookie `maxAge`) — carry over the
`ACCESS_TOKEN_COOKIE` / `DEFAULT_ACCESS_TOKEN_TTL_MS` / `SKIP_CACHE_HEADER` module-level consts
from `auth.controller.ts` verbatim (including the `SKIP_CACHE_HEADER` comment explaining Tent's
proxy cache-bypass need — see `docs/agents/architecture/proxy.md`'s "Cache bypass" section).

Refactor `AuthController` to call the extracted helper instead of its own `#respond`/`#serialize`,
removing those two private methods and the now-unused consts from `auth.controller.ts`.

## `client-request.ts`

A new, entirely-new piece of parsing — nothing in the backend currently reads these headers.
Exports a function that takes an Express `Request` and returns `{ ip: string, userAgent: string }`:
- IP: first token of the `x-forwarded-for` header (comma-split, trimmed), falling back to
  `req.socket.remoteAddress` when the header is absent.
- User-Agent: `req.headers['user-agent'] ?? ''`.

## Files to Change

- `backend/src/auth/auth-response.ts` — new. Exports the extracted cookie-setting +
  `{ user, refreshToken }` + `X-Skip-Cache` response builder, and the `{ id, username, email, isAdmin }`
  user serializer (either as one combined function or two — either shape is fine as long as
  `AuthController` and the new controller both end up calling the exact same code).
- `backend/src/auth/auth.controller.ts` — remove `#respond`/`#serialize` and the consts they own,
  replace their call sites with the new helper, keep all existing route behavior unchanged.
- `backend/src/core/client-request.ts` — new. IP/User-Agent extraction helper described above.
