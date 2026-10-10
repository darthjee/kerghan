# Tent standalone configuration

Write a Tent configuration for the standalone stack, derived from `proxy/prod_configuration/`
(read it, do not edit it — `proxy/` belongs to the `proxy` agent). Same behavior as production:
`*.json` to the backend (keeping the cache middlewares and `X-Skip-Cache`), the SPA rules with
the same CSP and the OAuth/GitHub App callback rules, `/assets` static, and the catch-all
`GET /path -> /#/path` redirect. No Navi, no `/admin`, no proxy `extension/`.

`locals.php` is committed (not a `.sample`) and holds no secrets:

- `$backendHost = 'http://kerghan:3000/';`
- `$staticRoot = '/var/www/html';` (rules use `$staticRoot . '/static'`)
- `$cacheFolder = './cache';`

Add a short header comment in `configure.php` saying it mirrors `proxy/prod_configuration/` and
must be kept in sync with it.

## Files to Change

- `standalone/vault/tent/configuration/configure.php` — new, loads `locals.php` and the rules.
- `standalone/vault/tent/configuration/locals.php` — new, values above.
- `standalone/vault/tent/configuration/rules/backend.php` — new, from production.
- `standalone/vault/tent/configuration/rules/frontend.php` — new, from production.
- `standalone/vault/tent/configuration/rules/redirects.php` — new, from production.
