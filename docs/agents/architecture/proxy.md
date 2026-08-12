# Architecture — Proxy

Tent (`darthjee/tent`) is the single entry point on port 3000 in both dev and prod. It's a
small PHP reverse proxy/static file server, entirely backend-language-agnostic — it just
proxies to `http://backend:8080` and `http://frontend:8080` by container link alias (dev) or a
host-specific `$backendHost`/`$staticRoot` pair (prod). See
[How to Use Tent](../external/how-to-use-tent.md) for the full rule/middleware/cache reference —
this page only covers how Kerghan configures it.

## Rule loading order

`configure.php` requires rule files in order — order matters, later rules act as catch-alls:

1. `rules/frontend.php` — dev: proxies to Vite (HMR); prod: serves static `dist/` output
2. `rules/backend.php` — routes every `*.json`-suffixed URL to the Express backend, with cache
   middlewares (`SetClientIpMiddleware`, `CacheCleanupMiddleware`, `CacheStalenessMiddleware`)
3. `rules/redirects.php` — catch-all: `GET /path → /#/path` (302) — **must stay last**

There is no `rules/admin.php` — Kerghan has no admin UI (see `docs/agents/product.md`).

## Dev vs. prod configuration

`proxy/dev_configuration/` and `proxy/prod_configuration/` mirror the same rule shape, but
differ in where hosts/paths come from:

- **Dev** (`locals.php`): `$cacheFolder` only — hosts are hardcoded container link aliases
  (`http://backend:8080`, `http://frontend:8080`).
- **Prod** (`locals.php.sample`, real `locals.php` gitignored on the actual host):
  `$backendHost`, `$staticRoot`, `$cacheFolder` — since production isn't a docker-compose
  network, the backend (Render) and static assets (SSH host) live at real URLs/paths, not
  container aliases.

## Custom extension code

`proxy/extension/lib/` holds custom PHP classes extending Tent's own `Tent\Middlewares`/
`Tent\Cache` namespaces, wired up via `proxy/extension/loader.php`:

- `CacheControlMiddleware` — sets an explicit `Cache-Control: max-age=<N>` header (used by the
  static-serving prod frontend rule).
- `SetClientIpMiddleware` — overwrites `X-Forwarded-For` with Tent's own view of the client IP,
  so the backend can trust it.
- `TestHeaderMiddleware` — sample middleware demonstrating the extension pattern.
- `DomainHash` — derives a per-domain cache folder name (used internally by Tent's own caching).

This is deliberately a **small subset** of what Majora's own extension has. Majora's extension
also includes upload/photo-storage classes, a staff-access guard gating a `/staff/cache/...`
admin endpoint, and per-entity cache-cleanup maps — none of that was copied into Kerghan, since
it's coupled to concepts Kerghan doesn't have (an admin/staff role, file uploads, RPG entities).
Don't reintroduce that coupling without a product decision backing it — see `proxy.md` in
`.claude/agents/` for the full rule.

## Cache bypass (`X-Skip-Cache`)

The backend rule sets `'skip_cache_header' => 'X-Skip-Cache'`. Any backend response carrying
this header bypasses the Tent cache entirely. Given Kerghan is multi-tenant, expect most
endpoints to need it — only omit it for genuinely public, identical-for-everyone responses.

See `.claude/agents/proxy.md` for the full rule-structure reference and local dev commands.
