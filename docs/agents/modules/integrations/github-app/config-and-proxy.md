# GitHub App: server config and proxy

Part of the [GitHub App type](../github-app.md). Server variables, the disabled state and the Tent rules.

## Server config

| Variable | Status | Rules |
|---|---|---|
| `KERGHAN_GITHUB_APP_ID` | optional | The app id: a positive integer. |
| `KERGHAN_GITHUB_APP_SLUG` | optional | The app's URL slug: 1–100 characters of `[a-z0-9-]`. |
| `KERGHAN_GITHUB_APP_PRIVATE_KEY` | optional, secret | The app's private key: **base64** of the PEM file GitHub provides, in one line. Decoded and parsed at boot with `crypto.createPrivateKey`; must be an RSA private key. |
| `KERGHAN_GITHUB_APP_CLIENT_ID` | optional | The app's client id: 1–100 characters of `[A-Za-z0-9._-]`. |
| `KERGHAN_GITHUB_APP_CLIENT_SECRET` | optional, secret | The app's client secret. |

- All are read **once at boot** (DI, no env reads inside classes), trimmed.
- **All five unset or blank:** the `github_app` type is **disabled**.
- **All five set and valid:** enabled.
- **Some set, some not:** boot **fails**, with an error naming the missing variables (never
  printing any value). A malformed value (non-numeric id, bad slug, a key that doesn't decode or
  parse as RSA, bad client id) fails boot the same way, naming the variable only.
- The private key and the client secret are never logged, returned, or put in an error message,
  and are held as `Secret`s after boot.
- **Callback URL:** not a separate variable. It is the **origin** of `FRONTEND_BASE_URL` plus
  `/integrations/github_app/callback`, computed at boot. When the type is enabled:
  - `FRONTEND_BASE_URL` must be set, or boot fails;
  - with `NODE_ENV=production`, its origin must be `https`, or boot fails.
- **Per environment:** each environment registers **its own** GitHub App, so keys and callback
  URLs never cross environments:

  | Environment | Callback URL | Config |
  |---|---|---|
  | Dev | `http://localhost:3000/integrations/github_app/callback` (Tent's port) | Disabled by default. A developer who wants to try it registers a personal throwaway GitHub App and sets all five variables in `.env`; `.env.dev.sample` lists them commented out, with this explanation. |
  | CI | none | Unset: the type is disabled. Specs build the strategy and routes with fake config (a test-only RSA key generated in the spec) and the fake GitHub client. |
  | Production | `https://<public host>/integrations/github_app/callback` | All five set as backend host env vars. |

- **App settings to register on GitHub**, per environment:
  - *Callback URL*: the environment's callback URL above;
  - *Request user authorization (OAuth) during installation*: **on** (this disables the setup
    URL, which isn't used);
  - *Expire user authorization tokens*: either; the refresh token is never used;
  - *Webhook*: **inactive** (no webhook URL or secret);
  - repository permissions: Issues: read, Metadata: read; nothing else;
  - *Where can this GitHub App be installed?*: *Any account* in production; either in dev.
- The variables and the per-environment setup are documented in
  [environment variables](../../../environment-variables.md); `.env.dev.sample` lists them
  commented out.

### When disabled

- `POST /integrations/types.json` doesn't list `github_app`
  ([routes](../../../backend/routes/integrations.md#enabled-types)), so the type picker hides it
  ([frontend](../frontend.md#type-picker)).
- The three type-owned backend routes answer **404** `NOT_FOUND`, before any other check except
  auth and CSRF, as if they didn't exist.
- Existing `github_app` rows stay listed and can be renamed and deleted. Test answers
  `unavailable` ([Test connection](credentials.md#test-connection)); the UI disables *Test* and *Reconnect*
  for them and says the GitHub App is disabled on this server.

## Proxy (Tent)

### Landing page rule

A **dedicated Tent rule** for `/integrations/github_app/callback`, identical in behaviour to the
[OAuth App's landing rule](../oauth-app.md#landing-page-rule), in `rules/frontend.php` of
both `dev_configuration` and `prod_configuration`:

- **Matcher:** `GET` on the path `/integrations/github_app/callback`, with or without a query
  string, and nothing else (Tent's `exact` matcher on the path).
- **Precedence:** it wins over `backend.php` and `redirects.php` for this path, so the query
  string is never moved into the hash by the catch-all.
- **Handler:** production serves `index.html` from the static root; dev proxies to Vite.
- **Headers:** `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, reusing the
  OAuth App's `SetResponseHeadersMiddleware`.

### Backend routes

**No new Tent rule.** The start, callback and select routes end in `.json`, so the existing
backend rule forwards them. Their `X-Skip-Cache` header (cache class `never`) keeps them out of
Tent's cache, and Navi never warms them.
