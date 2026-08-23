# Issue: Build and deploy frontend

## Description

Set up the minimal frontend build/deploy pipeline for kerghan:
- Build for dev
- Use live dev (Vite server)
- Build and deploy in production
- Deploy of the proxy in production

Document every CircleCI environment variable the release chain needs.

## Current State

Most of the infrastructure is already mirrored from `darthjee/majora`:
- `docker-compose.yml` with `kerghan_fe`, `kerghan_proxy`, `kerghan_app` services
- `bin/deploy_frontend.sh` (shared deploy script with atomic swap)
- `.circleci/config.yml` with `upload_fe_files`, `upload_proxy_files`, `copy_proxy_configuration`, `upload_extension`, and `release` jobs
- `proxy/dev_configuration/` and `proxy/prod_configuration/` directories

Two of the originally suspected gaps turned out to already be resolved on inspection:
- `FRONTEND_DEV_MODE=true` is already set in `.env.dev.sample`, which `make setup` copies to `.env`; `kerghan_proxy` already loads `env_file: .env`, so the Vite dev-server proxying already works with no docker-compose change needed.
- `proxy/prod_configuration/rules/backend.php` already has a complete `Configuration::buildRule()` call — it was never left incomplete.

The one remaining gap is majora-specific dead code in `bin/deploy_frontend.sh`'s `run_build()`.

## Solution

### 1. Build for dev — Already functional

`docker-compose.yml` already runs `kerghan_fe` with Vite on port `3010:8080`, and `frontend/package.json` already has the `"server": "vite dev --host 0.0.0.0 --port 8080"` script.

**No changes needed.**

### 2. Use live for dev (Vite server) — Already functional

`proxy/dev_configuration/rules/frontend.php` already has the `FRONTEND_DEV_MODE === 'true'` branch that proxies to `http://frontend:8080` (Vite dev server with HMR), and `FRONTEND_DEV_MODE=true` is already set in `.env.dev.sample` (copied to `.env` by `make setup`), which `kerghan_proxy` already loads via `env_file: .env`.

**No changes needed.**

### 3. Build and Deploy in production — Clean up `run_build()`

The CI pipeline (`upload_fe_files` → `release`) already exists and works. However, `bin/deploy_frontend.sh` has a `run_build()` function inherited from majora with project-specific code that does not apply to kerghan:

```bash
function run_build() {
    npm run build
    rsync -r assets/images/ dist/assets/images/    # majora-specific
    rm -f $(find dist/assets/images/ -iname "*.pbm")  # majora-specific
}
```

The `rsync` and `rm` lines will fail or be no-ops since kerghan does not have the same image assets structure.

**Action:** Simplify to:

```bash
function run_build() {
    npm run build
}
```

Or, if static images exist, guard with:

```bash
function run_build() {
    npm run build
    if [ -d assets/images/ ]; then
        rsync -r assets/images/ dist/assets/images/
    fi
}
```

### 4. Deploy of proxy in production — Already functional

The CI jobs for proxy deploy (`upload_proxy_files`, `copy_proxy_configuration`, `upload_extension`, `release`) already exist, and `proxy/prod_configuration/rules/backend.php` already has a complete `Configuration::buildRule()` call.

**No changes needed.**

---

## CI Environment Variables

The following environment variables must be configured in CircleCI (Project Settings → Environment Variables):

| Variable | Description |
| --- | --- |
| `SSH_PRIVATE_KEY` | SSH private key for authenticating on the deploy server |
| `SSH_PORT` | SSH port of the deploy server (e.g. `22`) |
| `SSH_USER` | SSH user on the deploy server |
| `SSH_HOST` | Host/IP of the deploy server |
| `SSH_REMOTE_DIR` | Final target directory on the server (e.g. `/home/kerghan_user/kerghan`) |
| `SSH_REMOTE_TEMP_DIR` | Base temporary directory on the server for staging |
| `RENDER_API_KEY` | Render API token for backend deployment |

> `CIRCLE_TAG` and `CIRCLE_WORKFLOW_WORKSPACE_ID` are provided automatically by CircleCI.

## Benefits

- Removes dead majora-specific code from the shared deploy script so the production build step doesn't fail or silently no-op on kerghan.
- Confirms and documents that the dev-mode Vite proxying and the production proxy backend routing already work correctly, avoiding redundant/incorrect changes.
- Gives whoever configures CircleCI a single place listing every environment variable the release chain requires.
