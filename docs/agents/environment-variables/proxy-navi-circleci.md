# Proxy, Cache Warmer and CircleCI Variables

[Back to Environment Variables](../environment-variables.md)

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
`upload_fe_files`, `release`, `release-kerghan-assets`), gated to semver tag pushes, requires
every variable below. No real Render service or SSH deploy host exists for Kerghan yet, though —
provisioning that infrastructure and filling in these values is a separate, not-yet-done step;
until then, a tag push runs the jobs but they fail against unset/placeholder credentials.

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
| `GITHUB_TOKEN` | Creates the GitHub release of the tag (when missing) and uploads the client/installer assets (`kerghan`, `install.sh`, `config.example`, `SHA256SUMS`). Needs `contents: write` on `darthjee/kerghan`; read by `gh` directly. | `bin/release_kerghan_assets.sh` (`release-kerghan-assets` CI job) |
| `CODACY_PROJECT_TOKEN` | Coverage upload target, read implicitly by Codacy's own uploader script. | `backend_tests`/`jasmine` CI jobs |

