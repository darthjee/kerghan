# Proxy Plan: Integration type: GitHub OAuth App

Main plan: [plan.md](plan.md)

## Shared contracts

What proxy **produces**:

- `GET /integrations/oauth_app/callback` (with any query string, and no other path) returns the
  SPA's `index.html`, with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- The rule never goes through the `/path → /#/path` redirect (`redirects.php`) or the backend
  rule (`backend.php`).
- The backend routes `POST /integrations/oauth_app/{start,callback}.json` need **no** new rule:
  the existing `.json` backend rule forwards them.

## Implementation Steps

### Step 1 — Header middleware

Add `Tent\Middlewares\SetHeadersMiddleware`, configured with a `headers` map. Each header
replaces any existing occurrence case-insensitively, as `CacheControlMiddleware` does. Use it to
set `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.

- Require it in `loader.php`.
- PHPUnit specs: it sets and replaces headers, and builds from attributes.
- PSR-12 lint passes.

Extending `CacheControlMiddleware` with a `no-store` mode is an acceptable alternative. A
generic middleware is preferred, because `Referrer-Policy` is needed too.

### Step 2 — Landing rules

Add a rule at the **top** of both `frontend.php` files, so it wins (`frontend.php` already loads
before `backend.php` and `redirects.php`).

**Matcher:** `GET` on `/integrations/oauth_app/callback`.

- First check how Tent's `exact` matcher treats the query string. If it compares the full URI
  including `?…`, use a regex matcher anchored as `^/integrations/oauth_app/callback(\?|$)`.
- It must not prefix-match other paths.

**Production** (`prod_configuration/rules/frontend.php`, and the non-dev branch of
`dev_configuration/rules/frontend.php`):

- the `static` handler on the static root;
- `SetPathMiddleware` → `/index.html`;
- `SetHeadersMiddleware` with the two headers;
- no `CacheControlMiddleware` max-age and no file cache.

**Dev** (`FRONTEND_DEV_MODE=true`):

- proxy to `http://frontend:8080` with `SetPathMiddleware` → `/` (Vite's `index.html`);
- the same header middleware.

Also confirm that the production Apache `.htaccess` (copied by the `copy_proxy_configuration`
job) sends this path to Tent like any other path, and that the built `index.html` references
assets by absolute `/assets/…` paths in both dev and prod.

## Files to Change

- `proxy/extension/lib/middlewares/SetHeadersMiddleware.php` — new.
- `proxy/extension/loader.php` — require it.
- `proxy/extension/tests/middlewares/SetHeadersMiddlewareTest.php` — new PHPUnit specs.
- `proxy/prod_configuration/rules/frontend.php` — the landing rule.
- `proxy/dev_configuration/rules/frontend.php` — the landing rule in both branches.

## CI Checks

- `proxy/`: `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`)
- `proxy/`: `docker-compose run --rm proxy_lint` (local PSR-12 check)

## Notes

- Verify in dev that `curl -i 'http://localhost:3000/integrations/oauth_app/callback?code=x&state=y'`
  returns the SPA (not a redirect), with both headers. This is also step 1 of the post-merge
  smoke check.
