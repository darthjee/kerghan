# Production configuration CSP

In `proxy/prod_configuration/rules/frontend.php`, define the production policy once at the top of the file (e.g. `$contentSecurityPolicy = "...";`, with the directives joined by `; `), using the exact `CSP_PROD` value from [../proxy.md](../proxy.md).

- **Callback rule** (`/integrations/oauth_app/callback`, `/integrations/github_app/callback`): add `'Content-Security-Policy' => $contentSecurityPolicy` to the existing `SetResponseHeadersMiddleware` header map, next to `Cache-Control` and `Referrer-Policy`.
- **`/` rule**: add a `SetResponseHeadersMiddleware` entry with only `Content-Security-Policy`, after the existing `SetPathMiddleware` and `CacheControlMiddleware`.
- **`/assets` rule**: leave unchanged.

Update the callback rule's comment to mention the CSP.

## Files to Change
- `proxy/prod_configuration/rules/frontend.php` — define the prod CSP and attach it to the callback and `/` rules.
