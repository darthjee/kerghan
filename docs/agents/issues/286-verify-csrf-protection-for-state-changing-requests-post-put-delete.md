# Issue: Verify CSRF protection for state-changing requests (POST/PUT/DELETE)

## Description
It has never been explicitly confirmed whether Kerghan is protected against Cross-Site Request Forgery (CSRF) on its state-changing endpoints (`POST`/`PATCH`/`DELETE` under `/auth/*` and `/admin/*`). The proxy's HMAC cache tokens are a per-user cache key, not an anti-CSRF mechanism, so they don't answer the question.

## Problem
Authentication is cookie-based: `JwtGuard` reads the JWT only from the `access_token` cookie (`backend/src/core/jwt.guard.ts`), and browsers attach cookies automatically. Current state, from a first look:

- The cookie is `httpOnly` + `Secure` + `SameSite=Strict` (`backend/src/auth/auth-response.ts`), so browsers do not send it on cross-site requests. This is already covered by an e2e spec.
- CORS is off by default (same-origin only), or a credentialed allowlist from `KERGHAN_ALLOWED_ORIGINS`/`FRONTEND_BASE_URL`. `*` reflects any origin and is blocked only when `NODE_ENV=production`.
- The frontend and API share one origin through the Tent proxy (`*.json` goes to the backend).
- The only `GET` route is `/health.json`, so no state change happens over `GET`.
- The backend has no CSRF token and no custom-header check. Nest's default body parsers accept `application/x-www-form-urlencoded`, so a plain cross-site HTML form can reach any `POST` route.
- `SameSite` does not protect against same-site attackers (for example a compromised sibling subdomain). It also does not protect the unauthenticated mutating routes (`login.json`, `register.json`, `recover.json`, `reset-password.json`, `authorization-requests.json`), where login CSRF is the relevant threat.

Nothing records any of this as a deliberate decision, so a future change could quietly weaken it: relaxing `SameSite`, adding header-based auth, or adding a mutating `GET`.

## Expected Behavior
- Every `POST`/`PATCH`/`PUT`/`DELETE` request, authenticated or not, is rejected with `403` when it comes from a browser context on another site:
  - `Sec-Fetch-Site` is `cross-site`, or `same-site` from an origin that isn't allowed, **or**
  - `Origin` is present and is neither the request's own origin nor an entry in the resolved CORS allowlist (`KERGHAN_ALLOWED_ORIGINS` / `FRONTEND_BASE_URL`).
- Requests from the app's own origin and from allowlisted origins behave exactly as today.
- Requests with neither `Origin` nor `Sec-Fetch-Site` (non-browser clients such as the CLI device-authorization flow, curl and the cache warmer) are still allowed, because CSRF is a browser-only attack. `SameSite=Strict` remains the first layer of protection.
- Safe methods (`GET`/`HEAD`/`OPTIONS`) are never subject to the check, so CORS preflights keep working.
- The CSRF posture is documented in a new `docs/agents/architecture/security.md`, linked from `docs/agents/modules/auth.md`. The doc covers which layers protect which routes, why login CSRF on the unauthenticated routes is covered, and what residual risk is accepted.

## Solution
1. **Audit**: confirm the findings above across every mutating route, cookie attributes, CORS resolution, accepted content types and the Tent proxy. The proxy must forward `Origin`/`Sec-Fetch-Site` unchanged, or the check can't work.
2. **Origin check**: add a global backend guard/middleware in `backend/src/core/` that applies the rules above to all mutating methods. It reuses the origin list already resolved by `buildCorsOptions`, so there is one source of truth for trusted origins. Under the dev-only `*` allowlist it accepts any origin, matching CORS behavior.
3. **Tests**: unit specs for the check's decision table (header present/absent, same-origin, allowlisted, cross-site, safe methods). Add e2e coverage showing that a cross-site `POST` to an authenticated route and to `login.json` gets `403`, while a same-origin request succeeds. Keep the existing `SameSite=Strict` cookie assertion.
4. **Docs**: create `docs/agents/architecture/security.md` with a CSRF posture section, link it from `docs/agents/modules/auth.md` and `docs/agents/architecture.md`, and update the security agent's CSRF checklist item, which still says "if session-based auth is ever introduced".

## Benefits
- Kerghan's CSRF posture becomes an explicit, tested decision instead of an assumption.
- Future changes to cookies, CORS or auth transport can't silently reopen CSRF.
- This closes an open question from the security review backlog.
