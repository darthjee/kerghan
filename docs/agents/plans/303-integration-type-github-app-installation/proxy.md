# Proxy Plan: Integration type: GitHub App installation

Main plan: [plan.md](plan.md)

## Shared contracts

- `GET /integrations/github_app/callback` (with or without a query string) must serve the SPA's
  `index.html` (prod) / proxy to Vite (dev), win over `backend.php` and `redirects.php`, and send
  `Cache-Control: no-store` and `Referrer-Policy: no-referrer` — identical to the OAuth App
  landing rule.

## Implementation Steps

### Step 1 — Add the github_app landing path to the existing landing rules
In each of the three OAuth App landing rules (dev `FRONTEND_DEV_MODE === 'true'` proxy branch, dev
static `else` branch, prod), add a second matcher
`['method' => 'GET', 'uri' => '/integrations/github_app/callback', 'type' => 'exact']`, and update
the comment to cover both redirect types. `exact` compares the path only, so the spec's regex
fallback isn't needed; `frontend.php` already loads first, so precedence holds. Reuse
`SetResponseHeadersMiddleware` unchanged — no new middleware.

## Files to Change
- `proxy/dev_configuration/rules/frontend.php` — extra matcher in both landing rules.
- `proxy/prod_configuration/rules/frontend.php` — extra matcher in the landing rule.

## CI Checks
- `proxy`: `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`)
- `proxy`: `docker-compose run --rm proxy_lint` (PHPCS, local/Codacy only)

## Notes
- No PHPUnit test loads rule files today, so there is nothing to extend; verify with `php -l`,
  PHPCS, and `curl -i 'http://localhost:3000/integrations/github_app/callback?code=x&state=y'`
  (200 HTML, both headers, no 302).
