# Plan: Build and deploy frontend

Issue: [22-build-and-deploy-frontend.md](../../issues/22-build-and-deploy-frontend.md)

## Overview

`bin/deploy_frontend.sh` was mirrored from `darthjee/majora` and its `run_build()` function still carries majora-specific image-asset handling that doesn't apply to kerghan (no `assets/images/` directory, no `.pbm` files). This plan removes that dead code so the `upload_fe_files` CI job's build step (`bin/deploy_frontend.sh build`) doesn't run pointless/no-op commands.

Everything else the original issue asked for — dev build, dev-mode Vite proxying via the proxy, and the production proxy's backend routing rule — was verified during issue discussion to already work correctly and needs no changes; the CI environment variables the release chain requires are documented in the issue file itself.

## Context

- `docker-compose.yml`'s `kerghan_fe` service already runs Vite on `3010:8080`; `frontend/package.json` already has the `server` script.
- `proxy/dev_configuration/rules/frontend.php` already branches on `FRONTEND_DEV_MODE`, and that variable is already set via `.env.dev.sample` → `.env` (copied by `make setup`) → `kerghan_proxy`'s `env_file: .env`.
- `proxy/prod_configuration/rules/backend.php` already has a complete `Configuration::buildRule()` call.
- `.circleci/config.yml`'s `upload_fe_files` job runs `bin/deploy_frontend.sh build`, which calls `run_build()`.

## Implementation Steps

### Step 1 — Clean up `run_build()` in `bin/deploy_frontend.sh`

Remove the majora-specific `rsync`/`rm` lines from `run_build()`, since kerghan has no `assets/images/` directory to sync and no `.pbm` files to strip. Keep the function to just build the frontend:

```bash
function run_build() {
    npm run build
}
```

## Files to Change

- `bin/deploy_frontend.sh` — simplify `run_build()` to drop the majora-specific `rsync`/`rm -f find ... *.pbm` lines, keeping only `npm run build`.

## Notes

- No local/PR-gating CI check exercises this script directly — `upload_fe_files`/`release` only run on semver tag pushes as part of the release chain (`.circleci/config.yml`), so this change is best verified by reading the diff and confirming `frontend/dist/` still gets produced by `npm run build` (no dependency on the removed `assets/images/` step).
- Deliverables #1, #2, and #4 from the original issue required no code changes (see `## Overview`) — do not re-implement them.
