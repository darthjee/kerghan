# Verify build output and the running app

Production enforces the policy directly, so verify before opening the PR:

1. Build the frontend through docker-compose (`vite build`). Check that the built `dist/index.html` contains no inline `<script>` body or `<style>` block: only `<script type="module" src>`, `<link rel="modulepreload">` and `<link rel="stylesheet">` tags. If Vite emits any inline code, stop and report it, rather than adding `'unsafe-inline'` to the prod policy.
2. Run the proxy in static (prod-like) mode against that build. `curl -I` `/` and `/integrations/oauth_app/callback?code=x&state=y`, and confirm that exactly one `Content-Security-Policy` header carries the prod value. The callback must still carry `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
3. Confirm that `/assets/...`, `*.json` and redirect responses carry no CSP header.
4. In a browser, log in, open a few pages that use Bootstrap dropdowns and modals (Popper's CSSOM styles), and check the console for CSP violations.

Record what was checked in the PR description.

## Files to Change
- None (verification only).
