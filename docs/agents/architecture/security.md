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
   the login e2e spec). `Secure` is on by default and is dropped only when
   `KERGHAN_COOKIE_SECURE` is exactly `false`, or exactly `loopback` and the request's raw `Host`
   header is a loopback host (`localhost`, `127.0.0.0/8`, `[::1]`) with no `https` in
   `X-Forwarded-Proto` (issue #601). The standalone client sets `false` for a loopback bind and
   `loopback` for a non-loopback bind, only when the effective `FRONTEND_BASE_URL` is not `https`
   (issues #600, #601), and `true` otherwise. A spoofed `Host` or `X-Forwarded-Proto` only affects
   the spoofing client's own response, and `X-Forwarded-Proto` can only add `Secure`, never remove
   it. Accepted exposure: a non-`Secure` cookie on `127.0.0.1` is not port-scoped, so another
   local service on that host can see it. `httpOnly` and `SameSite=Strict` never change. Browsers never send them on a cross-site request, so a forged request
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
`darthjee/tent:1.3.0` image's `ProxyRequestHandler`; one of the
[five Tent behaviours](#tent-behaviours-the-security-model-relies-on) to recheck on a Tent
upgrade), so `Origin` and `Sec-Fetch-Site` reach the backend intact. `Host` does **not**:
`default_proxy`'s built-in middlewares move the client's `Host` to `X-Forwarded-Host` and set
`Host` to the upstream host (see Tent's `docs/guides/tent/host-header.md`). They match the header
name case-sensitively, so Kerghan's `CanonicalHostHeaderMiddleware` first turns every casing into
`Host` ([item 2](#tent-behaviours-the-security-model-relies-on) of that list). With it,
`OriginGuard`'s fallback branch (no `Sec-Fetch-Site`, `Origin` host equal to `Host`) compares
against the upstream host, never a value the client chose and never the host the browser used: it
admits none of the app's own requests and fails closed, so only the trusted-origin list admits
them. **Any future proxy rule or middleware on `*.json` must keep forwarding `Origin`,
`Sec-Fetch-Site` and `X-Forwarded-Host`, and must keep the client's `Host` away from the
backend.** If one strips or rewrites `Origin` or `Sec-Fetch-Site`, `OriginGuard` either fails
closed (`403` on legitimate requests) or open.

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
  the only `GET` routes are the public `/health.json` and `/ready.json` probes.
- **The probes expose only `app`, `status`, `version` and per-check `up`/`down` states**
  ([Health probes](./backend/request-pipeline.md#health-probes)): never a host, an error message,
  a stack trace or a credential. Publishing the release semver on an unauthenticated route is by
  design: the repository is open source and the release is already public (README, image tags,
  installer). Hardening Tent's `Server` / `X-Powered-By` headers is out of scope here.
- **Don't relax the cookies**: `access_token` and `refresh_token` stay `httpOnly` + `Secure` +
  `SameSite=Strict`, except the one documented opt-out of `Secure` above
  (`KERGHAN_COOKIE_SECURE=false` or `loopback`, plain-HTTP standalone only; never set it on a
  deployment reachable over a network), and the refresh token never goes back into a response body. Only
  `logged_in` (no secret, value `1`) is script-readable.
- **Don't bypass `OriginGuard`**: new mutating routes get it automatically as a global guard.
  Don't add an opt-out, and don't register another guard ahead of it that short-circuits.
- **Header-based auth needs its own review**: an `Authorization: Bearer` flow isn't sent
  automatically by browsers, so it changes the CSRF analysis. It also must not be added
  alongside the cookie without a security review.
- **Allowlist changes are trust changes**: `KERGHAN_ALLOWED_ORIGINS`/`FRONTEND_BASE_URL` define
  both CORS and CSRF trust (see `docs/agents/environment-variables.md`).

## Tent behaviours the security model relies on

Verified in `darthjee/tent:1.3.0`. **Recheck all five on a Tent upgrade** (code review plus a
live check against the dev stack), then move the version in this file by hand:
`scripts/bump_tent.sh` leaves it alone on purpose.

1. **Header forwarding**: `default_proxy` forwards the incoming request headers, `Origin` and
   `Sec-Fetch-Site` included. [`OriginGuard`](#csrf) (CSRF and login CSRF) depends on it.
2. **`Host` rewrite**: `default_proxy` moves the client's `Host` to `X-Forwarded-Host` and sets
   `Host` to the upstream host. This keeps the upstream `Host` out of the client's hands, and keeps
   `OriginGuard`'s `Origin`-equals-`Host` fallback fail-closed. `X-Forwarded-Host` holds a
   client-chosen value: never trust it.
   - **Tent defect**: the rename matches the header name case-sensitively (as in 1.0.3). On its
     own, a hand-crafted lower-case or mixed-case `host` header reaches the upstream as the
     client's own `Host`, in place of Tent's.
   - **Why it matters**: CSRF isn't exposed (browsers send `Host`, pages can't set it, and a
     client able to craft it is already admitted by sending neither `Sec-Fetch-Site` nor
     `Origin`). But the client would control the upstream `Host`: on an upstream edge that routes
     by `Host`, a crafted request could be answered by another service, and a 2xx `*.json` answer
     without `X-Skip-Cache` would then be cached and served to everyone.
   - **Workaround**: Kerghan's `CanonicalHostHeaderMiddleware` turns every casing into a single
     `Host`, which closes this. It belongs in `prependMiddlewares` (under `middlewares` it would
     run after the rename) of all three backend (`*.json`) rules: dev, production and standalone.
     With several casings the first occurrence wins; the image's Apache already answers such a
     request with `400`. The redirect rules also use `default_proxy` but never contact the
     upstream. `proxy/extension/tests/proxy/HostHeaderForwardingTest.php` checks the chain on a
     mirror of the backend rule (see item 3). Recheck it on a Tent upgrade, and remove it once
     Tent matches the name case-insensitively.
3. **Single-entry `X-Forwarded-For`**: Kerghan's `SetClientIpMiddleware` replaces it with
   `REMOTE_ADDR` and nothing later in Tent's chain appends to it (the image doesn't enable
   `mod_remoteip`). Standalone automatic login through the IP allowlist, with
   `KERGHAN_TRUSTED_PROXY_HOPS=1`, depends on it: a client-controlled entry would be an
   authentication bypass. `proxy/extension/tests/proxy/ClientIpForwardingTest.php` checks this on
   a mirror of the backend rule: it doesn't load the dev, production or standalone rule files, so
   a change to any of them must be copied into the test and reviewed by hand.
4. **Shared cache and `skip_cache_header`**: every 2xx `*.json` response is shared-cached by path
   and query string, never separated by caller or request body, unless it carries `X-Skip-Cache`.
   That header keeps `user-scoped` and `never` responses out of the shared cache. Don't rely on the
   request method to protect anything: a response to any method other than `GET`/`HEAD` is always
   `never` ([API Caching](./caching.md)).
   Tent's `BackgroundRefresher` (run by `CacheStalenessMiddleware`) replays the triggering
   request, headers included, and stores a 2xx refresh without checking `skip_cache_header`. It
   is unreachable today: `FileCacheMiddleware` runs first, and a cache hit ends the request chain
   before `CacheStalenessMiddleware`. If Tent makes it reachable, recheck items 3 and 4
   (`SetClientIpMiddleware` also sits after the cache read).
5. **`Set-Cookie` passthrough**: every `Set-Cookie` line reaches the client unchanged and is
   stripped from what the cache stores (one of Tent's default excluded headers, which no Kerghan
   rule overrides), so session cookies are never replayed to another caller.

## GitHub credentials stay in the backend

**Every GitHub call that uses a user's credential is made by the backend, and no endpoint ever
returns credential material (secrets, tokens, GitHub App installation tokens) or anything
computed from it, beyond the masked `secretHint` of the Integrations routes.** Data fetched
*with* a credential (the private-repo listing) is not credential material.

- For the repository listing and for linked Kerghan issues, every GitHub call happens in the
  backend, authenticated or not; the frontend never calls GitHub for them. Linked issues are read
  and written with the project owner's integration, inside the Integrations module
  ([Issues and Projects](../modules/issues/security.md#the-integrations-boundary)). (Fetched issue
  data is still read by the browser, unauthenticated, public repositories only.)
- Inside the backend, credentials stay **inside the Integrations module**
  ([GitHub service](../modules/integrations/github-service/api.md#exported-service)).
- A minted GitHub App installation token is a credential too: it is cached **in process memory
  only**, inside the Integrations module (in a `Secret`), never in the database, a log or a
  response, and minted with the least permission each operation needs (`metadata: read` for listings; `issues` read or write for linked issues, per operation)
  ([installation tokens](../modules/integrations/github-service/api.md#github-app-installation-tokens)). Any other persistence
  needs its own product decision (`CLAUDE.md`, #295).
- Repo responses carry no integration field beyond its `uuid` and label
  ([routes](../backend/routes/repositories/errors-and-access.md#access)).
- **The `secret_iv` compare value stays inside the Integrations module.** The status
  [compare-and-set](../modules/integrations/github-service/status-and-errors.md#status-compare-and-set) uses the `secret_iv` of the credential
  a call used; it never reaches the Repositories module, a response or a log.

Guarantees of the exported `IntegrationsGithubService`
([GitHub service](../modules/integrations/github-service/api.md#exported-service)):

- **Nothing sensitive leaves the module:** no decrypted credential, minted installation token or
  GitHub response body is returned, logged or exposed; callers get typed, normalised results
  only, and logs carry safe fields (integration id, operation, HTTP status, result kind).
- **Owner-scoped:** every call loads the integration with `WHERE id = ? AND user_id = ?`; a
  missing or foreign one answers `integration_unusable` without a GitHub call.
- **Fixed operations:** `IntegrationsGithubService` is `GET`-only. The only non-`GET` call is the
  single `IntegrationsGithubIssueWriter.updateIssue` (a `PATCH` of `title`, `body` and `state` only,
  [boundary](../modules/issues/security.md#the-integrations-boundary)), on a separate service that
  only the issues sync service injects. Endpoints and parameters are fixed; no generic
  `request(path)`, so no caller chooses a path.

The boundary is enforced by tooling in the Repositories module, the first consumer of
`IntegrationsGithubService` ([module boundaries](../modules/repositories/security.md#module-boundaries)).
