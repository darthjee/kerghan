# OAuth App: config and proxy

Part of the [OAuth App type](../oauth-app.md). Server config (and when the type is disabled) and the Tent proxy rules.

## Server config

| Variable | Status | Rules |
|---|---|---|
| `KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` | optional | The OAuth App's client id: 1–100 characters of `[A-Za-z0-9._-]`. |
| `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET` | optional, secret | The OAuth App's client secret. Never logged, never returned, never in an error message. |

- Both are read **once at boot** (DI, no env reads inside classes), trimmed.
- **Both unset or blank:** the `oauth_app` type is **disabled**.
- **Only one set:** boot **fails**, with an error naming the missing variable (never printing
  either value). A malformed client id fails boot the same way.
- **Callback URL:** not a separate variable. It is the **origin** of `FRONTEND_BASE_URL` plus
  `/integrations/oauth_app/callback`, computed at boot. When the type is enabled:
  - `FRONTEND_BASE_URL` must be set, or boot fails;
  - with `NODE_ENV=production`, its origin must be `https`, or boot fails.
- **Per environment:** each environment registers **its own** OAuth App on GitHub, whose
  *Authorization callback URL* is exactly that environment's callback URL:

  | Environment | Callback URL | Config |
  |---|---|---|
  | Dev | `http://localhost:3000/integrations/oauth_app/callback` (Tent's port) | Disabled by default. A developer who wants to try it registers a personal OAuth App and sets both variables in `.env`; `.env.dev.sample` lists them commented out, with this explanation. |
  | CI | none | Unset: the type is disabled. Specs build the strategy and routes with fake config and the fake GitHub client. |
  | Production | `https://<public host>/integrations/oauth_app/callback` | Both set as backend host env vars. |

- Both variables and the per-environment setup are documented in
  [environment variables](../../../environment-variables.md); `.env.dev.sample` lists them
  commented out.

### When disabled

- `POST /integrations/types.json` doesn't list `oauth_app`
  ([routes](../../../backend/routes/integrations.md#enabled-types)), so the type picker hides it
  ([frontend](../frontend.md#type-picker)).
- Both type-owned backend routes answer **404** `NOT_FOUND`, before any other check except
  auth and CSRF, as if they didn't exist.
- Existing `oauth_app` rows (from when it was enabled) stay listed and can be renamed, tested
  and deleted. Their delete skips revocation ([Behaviour on delete](lifecycle.md#behaviour-on-delete)). The
  UI doesn't offer *Reconnect* for them and says the OAuth App is disabled on this server.

## Proxy (Tent)

### Landing page rule

A **dedicated Tent rule** serves the frontend directly for the landing path, so it never goes
through the `GET /path → /#/path` catch-all (which would move `code` and `state` into the hash)
nor the backend's `.json` rule. It lives in `rules/frontend.php` of both `dev_configuration` and
`prod_configuration`:

- **Matcher:** `GET` on the path `/integrations/oauth_app/callback`, with or without a query
  string, and nothing else (Tent's `exact` matcher on the path; no prefix match on other
  paths).
- **Precedence:** the rule must win over `backend.php` and `redirects.php` for this path;
  `frontend.php` is already loaded first in both `configure.php` files.
- **Handler:** production serves `index.html` from the static root (the `static` handler with
  `SetPathMiddleware` to `/index.html`, like the `/` rule). Dev proxies to the Vite server,
  which answers its SPA `index.html`.
- **No caching:** `Cache-Control: no-store`, and no Tent file cache (the `static` handler doesn't
  use one). The headers are set by `SetResponseHeadersMiddleware`
  (`proxy/extension/lib/middlewares/`), since `CacheControlMiddleware` only sets `max-age`.
- **Referrer policy:** the response carries `Referrer-Policy: no-referrer`, so the URL with
  `code` and `state` never leaks through a `Referer` header before `replaceState` runs.
- The SPA's assets must load from this nested path: they are referenced by absolute paths
  (`/assets/…`) in both dev and production builds.

### Backend routes

**No new Tent rule.** `POST /integrations/oauth_app/start.json` and
`POST /integrations/oauth_app/callback.json` end in `.json`, so the existing backend rule
forwards them. Their `X-Skip-Cache` header (cache class `never`) keeps them out of Tent's cache,
and Navi never warms them.

