# Security

Cross-cutting security posture decisions that span the backend, the Tent proxy and the
frontend. Per-module details (JWT, refresh tokens, admin authorization) live in
[`docs/agents/modules/auth.md`](../modules/auth.md).

## CSRF

Kerghan authenticates browsers with cookies (`access_token`, read only by `JwtGuard` in
`backend/src/core/jwt.guard.ts`, and `refresh_token`, read only by the `/auth` routes through
`backend/src/auth/auth-cookies.ts`), and browsers attach cookies automatically. That makes
Cross-Site Request Forgery a real threat, so Kerghan protects against it on purpose, in layers.
The proxy's HMAC cache tokens (`core/cache-token.service.ts`) are a per-user cache key. They are
**not** an anti-CSRF mechanism.

### Layers

1. **`SameSite=Strict` cookies**: `access_token` (`Path=/`) and `refresh_token`
   (`Path=/auth`) are `httpOnly` + `Secure` + `SameSite=Strict`, and the readable `logged_in`
   marker is `Secure` + `SameSite=Strict` too (`backend/src/auth/auth-cookies.ts`, locked in by
   the login e2e spec). Browsers never send them on a cross-site request, so a forged request
   from another site arrives unauthenticated and without a refresh token.
2. **Credentialed CORS allowlist**: CORS is off (same-origin only) unless
   `KERGHAN_ALLOWED_ORIGINS` or, as a fallback, `FRONTEND_BASE_URL` is set
   (`backend/src/core/cors-config.ts`). This stops other sites from *reading* responses. It does
   not stop a request from being *sent*: a plain HTML form `POST` needs no preflight, and Nest's
   default body parsers accept `application/x-www-form-urlencoded`.
3. **`OriginGuard`**: `backend/src/core/origin.guard.ts` is the first global `APP_GUARD`, ahead
   of `JwtGuard`. It rejects every cross-site `POST`/`PUT`/`PATCH`/`DELETE` with `403`, whether
   the route is authenticated or not. It trusts exactly the origins CORS trusts: the list
   resolved by `buildCorsOptions`, so there is one source of truth. Under the dev-only `*`
   allowlist it trusts any origin, the same as CORS. Because it runs before `JwtGuard`, a forged
   request to an authenticated route gets `403`, not `401`.

`OriginGuard`'s decision table (safe methods `GET`/`HEAD`/`OPTIONS` always pass, so CORS
preflights keep working):

| `Sec-Fetch-Site` | `Origin` | Result |
|---|---|---|
| `same-origin` or `none` | any | allow |
| `same-site` or `cross-site` | in trusted origins | allow |
| `same-site` or `cross-site` | absent or untrusted | **403** |
| absent | absent | allow (non-browser client) |
| absent | trusted, or its host equals the request's `Host` header | allow (older browsers) |
| absent | any other value | **403** |

Edge cases, decided in the implementation (`isCrossSiteRequestAllowed` in the same file):

- An unrecognized `Sec-Fetch-Site` value is treated like `cross-site`, so it needs a trusted
  `Origin`.
- An unparseable `Origin`, including the literal `null` (sandboxed iframes, some redirects), is
  never trusted, even under the dev-only `*` allowlist.
- The method check ignores case. If a header is repeated, only its first value is used. The
  `Host` comparison includes the port.

The frontend and the API share one origin through Tent (`*.json` goes to the backend), so the
app's own requests are always `same-origin`. Tent's `default_proxy` handler forwards incoming
request headers (`getallheaders()` straight into its curl executor, verified in the
`darthjee/tent:1.0.3` image's `ProxyRequestHandler`; recheck on a Tent upgrade), so `Origin` and
`Sec-Fetch-Site` reach the backend intact. `Host` does **not**: `default_proxy`'s built-in
middlewares move the client's `Host` to `X-Forwarded-Host` and set `Host` to the upstream host
(see Tent's `docs/guides/tent/host-header.md`). As a result, `OriginGuard`'s fallback branch
(no `Sec-Fetch-Site`, `Origin` host equal to `Host`) never matches behind Tent and fails closed —
only the trusted-origin list admits such requests. **Any future proxy rule or middleware on
`*.json` must keep forwarding `Origin`, `Sec-Fetch-Site` and `X-Forwarded-Host`.** If one strips
or rewrites them, `OriginGuard` either fails closed (`403` on legitimate requests) or open.

### Unauthenticated routes (login CSRF)

`SameSite` can't help routes that need no cookie: `login.json`, `register.json`, `recover.json`,
`reset-password.json` and the device-authorization `create`/`poll` routes. On those routes the
threat is *login CSRF*: a forged form logs the victim into the attacker's account, or triggers
recovery emails. `OriginGuard` covers these routes too, because it applies to every mutating
method regardless of `@Public()`.

The `@Public()` routes that act on the `refresh_token` cookie (`refresh.json`, `logoff.json`,
`status.json`) need no guard change (#324): a cross-site request never carries the
`SameSite=Strict` cookie, so it can only reach them without a token (a `401`, a no-op logoff or
`loggedIn: false`), and `OriginGuard` rejects it with `403` before that anyway. The cookie's
`Path=/auth` also keeps it off every non-`/auth` request. The one exception is the temporary
`refresh.json` body fallback (`TODO(#324-migration)`), which accepts a body token only when the
cookie is absent; a forged request can't read the response (CORS) and is blocked by
`OriginGuard`, so it adds no CSRF exposure.

### Why requests with neither header are allowed

CSRF is a browser-only attack, and every current browser sends `Sec-Fetch-Site` and/or `Origin`
on a mutating request. A request with neither comes from a non-browser client: the CLI
device-authorization flow, curl, the Navi cache warmer, or the backend's own supertest e2e
specs. Rejecting those would break legitimate tooling without stopping any browser-borne
attack.

### Accepted residual risk

- **Same-site or allowlisted attackers**: an origin in `KERGHAN_ALLOWED_ORIGINS` is fully
  trusted. A compromised allowlisted origin can forge requests, so keep the allowlist minimal.
  Never use `*` outside development (boot already refuses it when `NODE_ENV=production`).
- **Browsers that send neither header**: very old browsers fall into the "non-browser" row and
  rely on `SameSite=Strict` alone. That still covers the authenticated routes; only the
  unauthenticated ones are exposed there.
- **Proxy cache cleanup before rejection**: the `*.json` rule runs Tent's
  `CacheCleanupMiddleware` before the request reaches the backend, so a forged mutating request
  can still clear the proxy cache folders it targets (`collection`, `entity`) even though
  `OriginGuard` then rejects it with `403`. The effect is only cache churn: no data changes and
  nothing leaks, and nearly all Kerghan responses already bypass the cache (`X-Skip-Cache`, from their
  `user-scoped`/`never` cache class — see [API Caching](./caching.md)).
  This is accepted for now; revisit it if the cache starts carrying expensive shared data.
- **Form-encoded bodies**: Nest's default `urlencoded` parser stays enabled. With `OriginGuard`
  in place, a cross-site form never reaches a handler, so this is harmless.

### Rules for future changes

- **No state change over `GET`** (or `HEAD`/`OPTIONS`). Those methods skip `OriginGuard`. Today
  the only `GET` routes are the public `/health.json` and `/ready.json` probes; `/ready.json`
  exposes only per-check `up`/`down` states, never error details.
- **Don't relax the cookies**: `access_token` and `refresh_token` stay `httpOnly` + `Secure` +
  `SameSite=Strict`, and the refresh token never goes back into a response body. Only
  `logged_in` (no secret, value `1`) is script-readable.
- **Don't bypass `OriginGuard`**: new mutating routes get it automatically as a global guard.
  Don't add an opt-out, and don't register another guard ahead of it that short-circuits.
- **Header-based auth needs its own review**: an `Authorization: Bearer` flow isn't sent
  automatically by browsers, so it changes the CSRF analysis. It also must not be added
  alongside the cookie without a security review.
- **Allowlist changes are trust changes**: `KERGHAN_ALLOWED_ORIGINS`/`FRONTEND_BASE_URL` define
  both CORS and CSRF trust (see `docs/agents/environment-variables.md`).
