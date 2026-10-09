# Proxy Plan: Add a Content-Security-Policy

Main plan: [plan.md](plan.md)

## Overview
Add a `Content-Security-Policy` response header to every proxy rule that serves the SPA's `index.html`, in both the production and development configurations. Enforce it directly, with no Report-Only phase. Asset, `.json` backend and redirect rules are left unchanged: CSP only matters on the document.

## Context
- Production: Tent serves the built `dist/` statically (`proxy/prod_configuration/rules/frontend.php`). Development: Tent proxies to the Vite dev server (`proxy/dev_configuration/rules/frontend.php`, `FRONTEND_DEV_MODE=true` branch). That file also has a static, prod-like `else` branch.
- The frontend has no inline script or style, no CDN, no `eval` and no third-party origin. Bootstrap and bootstrap-icons are bundled, Bootstrap's CSS uses `data:` SVGs, and the API is same-origin `.json`.
- `SetResponseHeadersMiddleware` (`proxy/extension/lib/middlewares/SetResponseHeadersMiddleware.php`) already sets fixed response headers on the callback rules. It replaces any existing header of the same name, case-insensitively.

Policies (exact values):

- **Production / static** (`CSP_PROD`):
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
- **Vite dev** (`CSP_DEV`): the same directives, loosened only where Vite needs it (inline React-refresh preamble, injected `<style>` tags, HMR websocket):
  `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`

## Steps

- [01 — Production configuration CSP](proxy/01-prod-configuration-csp.md)
- [02 — Development configuration CSP](proxy/02-dev-configuration-csp.md)
- [03 — Verify build output and the running app](proxy/03-verify.md)

## CI Checks
- `proxy/extension`: `vendor/bin/phpunit --bootstrap /var/www/html/extension/tests/bootstrap.php /var/www/html/extension/tests` inside the `darthjee/tent-test` image, run through docker-compose (CI job: `proxy_extension_tests`). This plan changes no extension code, so it only needs to keep passing.

## Notes
- Prod `/` is served with `Cache-Control: max-age=86400`, so browsers may keep the old (missing) CSP for up to a day after deploy. That is acceptable. The callback rules are `no-store` and pick it up immediately.
- Out of scope, as decided in the issue: backend/helmet headers on JSON responses, and a `report-uri`/`report-to` endpoint.
- A `security` agent review should follow the implementation.
- If a future dependency adds inline script, a CDN or `eval`, the policy must be updated alongside it.
