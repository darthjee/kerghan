# Development configuration CSP

In `proxy/dev_configuration/rules/frontend.php`:

- **`FRONTEND_DEV_MODE=true` branch (Vite):**
  - Use the `CSP_DEV` value from [../proxy.md](../proxy.md).
  - Add it to the callback rule's existing `SetResponseHeadersMiddleware` map.
  - Split the combined Vite rule so `/` (exact) becomes its own rule with a `SetResponseHeadersMiddleware` carrying the CSP. The `/assets/js|css|images`, `/@vite/`, `/node_modules/` and `/@react-refresh` matchers stay in a rule without it. The CSP header on JS/CSS responses is harmless, but keeping it to the document matches prod.
- **`else` branch (static, prod-like):**
  - Use the exact `CSP_PROD` value, so that running the built bundle locally exercises the real production policy.
  - Add it to the callback rule's map and to the `/` rule, as in step 01.

Then bring up the dev stack through docker-compose (never on the host) and confirm that the app loads with HMR working and no CSP violations in the browser console. Also confirm the HMR websocket connects through Vite's configured host and port. If it does not use `ws:`/`wss:`, adjust `connect-src` accordingly.

## Files to Change
- `proxy/dev_configuration/rules/frontend.php` — dev CSP on the Vite `/` and callback rules, prod CSP on the static branch's `/` and callback rules.
