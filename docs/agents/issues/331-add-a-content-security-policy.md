# Issue: Add a Content-Security-Policy

## Description
Spun off from #324, which moved the refresh token into an httpOnly cookie. Kerghan serves no Content-Security-Policy, so an XSS bug can run arbitrary script on the page.

## Problem
No `Content-Security-Policy` header is sent anywhere. In production the PHP Tent proxy (`kerghan.ffavs.net`) serves `index.html` and `/assets/*` as static files (`proxy/prod_configuration/rules/frontend.php`). In development the same proxy forwards those paths to the Vite dev server (`proxy/dev_configuration/rules/frontend.php`). Neither sets a CSP. The backend on Render only serves `.json` and has no security headers (no `helmet`). Nothing in the browser limits what an injected script can do.

## Expected Behavior
The HTML document (`/` and the `/integrations/{oauth_app,github_app}/callback` landing pages) is served with a strict CSP, and the app keeps working in development and production.

Production policy:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Why this policy works for the app as it is today:
- The built `index.html` loads one module script and has no inline script or style.
- Bootstrap and bootstrap-icons are bundled locally.
- Bootstrap's CSS uses `data:` SVG images.
- Popper sets inline styles through the CSSOM, which `style-src` allows.
- All API calls are relative `.json` paths.
- The GitHub OAuth links are top-level navigations, not fetches.

## Solution
- Set the header in the proxy with the existing `proxy/extension/lib/middlewares/SetResponseHeadersMiddleware.php`. Add it to the `/` and callback rules in both prod and dev configurations. The callback rules already set `Referrer-Policy` and `Cache-Control`, so the CSP is added to those header maps.
- Development also sends a CSP: the same directives, loosened only where Vite needs it, so most CSP problems show up locally. Vite injects `<style>` tags and an inline React-refresh preamble, and HMR uses a websocket. That means `'unsafe-inline'` for scripts and styles, and `ws:` in `connect-src`.
- Before enforcing, check that `vite build` output contains no inline script.
- Enforce the production policy directly, with no Report-Only phase. There is no inline script, CDN or `eval` to trip it, and the build-output check covers the remaining risk.
- Out of scope: security headers on the backend's JSON responses, and a CSP reporting endpoint (`report-uri`/`report-to`). Check violations by hand in the browser console.
- Note: `/` is cached for one day in prod, so a policy change can take up to a day to reach browsers.
- Owner: the `proxy` agent, with a `security` review.

## Benefits
Limits the damage an XSS bug can do: no inline or third-party script, no exfiltration to other origins, and no framing (clickjacking).
