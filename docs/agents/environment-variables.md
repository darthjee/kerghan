# Environment Variables

Every environment variable Kerghan's production deployment needs, gathered from what the code
actually reads (not just what's documented elsewhere) — grep the `Source` column if in doubt.
Local dev's equivalent is `.env.dev.sample` (copied to `.env` by `make setup`); nothing here
should drift from that file without a reason noted below. Real `.env.prod` / CircleCI project
variables are never committed (`.gitignore`) — this doc is the map for filling them in.

## 1. Backend application runtime

Set on the backend host (Render service env vars in the real deployment; `.env.prod` when
running `kerghan_prod_app` locally to sanity-check the production image).

| Variable | Status | Purpose | Source |
|---|---|---|---|
| `KERGHAN_SECRET_KEY` | **Consumed** | Signs the `express-session` cookie. Must be a long random value in production — the dev sample ships an intentionally insecure placeholder. | `backend/bin/server.js`, `backend/lib/server/Router.js` |
| `NODE_ENV` | **Consumed** | `production` selects the `production` Sequelize config block and marks the session cookie `secure: true` (HTTPS-only). | `backend/bin/server.js`, `backend/models/index.js` |
| `PORT` | **Consumed**, optional | Port the Express server listens on (defaults to `8080`). Render injects its own `PORT` automatically — only set this explicitly for other hosts. | `backend/bin/server.js` |
| `KERGHAN_MYSQL_HOST` | **Consumed** | Production MySQL connection. | `backend/config/database.js` |
| `KERGHAN_MYSQL_PORT` | **Consumed** | ditto | `backend/config/database.js` |
| `KERGHAN_MYSQL_USER` | **Consumed** | ditto | `backend/config/database.js` |
| `KERGHAN_MYSQL_PASSWORD` | **Consumed** | ditto | `backend/config/database.js` |
| `KERGHAN_MYSQL_NAME` | **Consumed** | ditto | `backend/config/database.js` |
| `KERGHAN_ALLOWED_ORIGINS` | Reserved, not yet read | Intended for CORS restriction once a cross-origin frontend call exists. Currently in `.env.dev.sample` but no CORS middleware exists yet — safe to set for when it lands, has no effect today. | — |
| `FRONTEND_BASE_URL` | Reserved, not yet read | No consumer yet (candidate: links in future emails, or a CORS allow-list entry). | — |
| `EMAILS_ENABLED` | Reserved, not yet read | No email-sending code exists in the backend yet (candidate future use: account/digest notifications). | — |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` / `EMAIL_USE_TLS` / `DEFAULT_FROM_EMAIL` | Reserved, not yet read | ditto | — |

**GitHub credentials — deliberately none.** Kerghan reads only public GitHub REST API data,
unauthenticated (see `docs/agents/product.md`). There is no PAT/OAuth/App var to set for this,
now or in production — don't add one without an explicit product decision.

## 2. Proxy (production)

The production Tent proxy needs **no environment variables** — its config comes entirely from
`proxy/prod_configuration/locals.php` (real file gitignored; `locals.php.sample` is the
committed template), which is generated directly on the SSH host, not read from `.env.prod`.
`FRONTEND_DEV_MODE` only matters in `proxy/dev_configuration/` (local dev's Vite-vs-static
toggle) — don't look for a production equivalent, there isn't one.

## 3. Cache warmer (Navi)

Used by the `kerghan_navi` compose service and the CI `warm-up-cache`/`wake-navi` jobs (see
`docs/agents/cache-warmer.md`):

| Variable | Purpose | Source |
|---|---|---|
| `KERGHAN_PRODUCTION_URL` | Base URL Navi warms requests against. | `navi/resources/clients.yml`, `docker-compose.yml` |
| `NAVI_NAMEPACE` | Navi cache namespace. | `navi/resources/clients.yml`, `scripts/warm_navi_cache.sh` |
| `NAVI_PORT` | Port Navi's own web UI listens on locally (`3100` in dev). | `navi/navi_config.yaml`, `docker-compose.yml` |

## 4. CircleCI project variables (deploy pipeline)

Not part of any `.env` file — set directly in CircleCI's project (or org) settings, consumed as
plain shell env vars by `scripts/`/`bin/` during CI jobs. `.circleci/config.yml`'s release chain
(`build-and-release`, `upload_proxy_files`, `copy_proxy_configuration`, `upload_extension`,
`upload_fe_files`, `release`), gated to semver tag pushes, requires every variable below. No real
Render service or SSH deploy host exists for Kerghan yet, though — provisioning that
infrastructure and filling in these values is a separate, not-yet-done step; until then, a tag
push runs the jobs but they fail against unset/placeholder credentials.

| Variable | Purpose | Used by |
|---|---|---|
| `DOCKER_ID_USER` | Docker Hub namespace for pushed images (frontend/proxy only — the backend image is never published, see `docs/agents/architecture/backend.md`). | `bin/image.sh` |
| `DOCKER_HUB_USERNAME` / `DOCKER_HUB_PASSWORD` | Docker Hub login for pushing images. | `bin/image.sh` |
| `RENDER_API_KEY` | Authenticates Render API calls (trigger/watch deploys). | `scripts/render.sh` |
| `RENDER_SERVICE_NAME` | Which Render service to deploy (defaults to `kerghan`). | `scripts/render.sh` |
| `SSH_PRIVATE_KEY` | SSH key for the proxy/static-asset deploy host. | `bin/deploy_frontend.sh` |
| `SSH_HOST` / `SSH_PORT` / `SSH_USER` | ditto | `bin/deploy_frontend.sh` |
| `SSH_REMOTE_DIR` | Live path on the deploy host, atomically swapped on release. | `bin/deploy_frontend.sh` |
| `SSH_REMOTE_TEMP_DIR` | Workspace-scoped staging path before the atomic swap. | `bin/deploy_frontend.sh` |
| `NAVI_URL` | Navi server URL for cache warm-up and wake calls. | `scripts/warm_navi_cache.sh`, `scripts/wake_navi.sh` |
| `NAVI_API_TOKEN` | Auth token for Navi's `navi-client`. | `scripts/warm_navi_cache.sh` |
| `KERGHAN_NAMESPACE` | Combined with the CircleCI workspace ID to build a per-build Navi namespace. | Not yet consumed — reserved for a future `warm-up-cache` job (cache warm-up is out of scope for the current release chain; see `docs/agents/cache-warmer.md`). |
| `CODACY_PROJECT_TOKEN` | Coverage upload target, read implicitly by Codacy's own uploader script. | `backend_tests`/`jasmine` CI jobs |

## Keeping this doc honest

If you add code that reads a new `process.env.*` / `getenv()` value, or wire up a var currently
marked "Reserved, not yet read," update its row here in the same change — this doc is only useful
if it matches what the code actually does.
