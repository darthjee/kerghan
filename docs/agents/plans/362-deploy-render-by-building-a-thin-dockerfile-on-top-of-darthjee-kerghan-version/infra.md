# Infra Plan: Deploy Render by building a thin Dockerfile on top of darthjee/kerghan:<version>

Main plan: [plan.md](plan.md)

## Overview
Render rejects the image-URL deploy introduced by #341 because the `kerghan` service is Git-backed
(`dockerfilePath: ./dockerfiles/production_kerghan/Dockerfile`, `dockerContext: .`, branch `0.5.0`,
auto-deploy on commit). Make Render's build trivial instead: the thin Dockerfile at that same path is
only `FROM darthjee/kerghan:<version>`, so production runs exactly the image `release-kerghan`
publishes, with no Render dashboard change.

## Context
- `scripts/deploy.sh deploy` currently POSTs `{"imageUrl": "docker.io/darthjee/kerghan:<tag>"}` and
  fails with `cannot deploy images for non-image backed service`.
- Before #341 (`git show cf661db^:scripts/render.sh`), the flow was `update_service_branch` (PATCH
  `{"branch": "<tag>"}`) then a plain `POST /deploys`, then `watch_deployment`.
- `bin/release_kerghan.sh` builds `darthjee/kerghan` from `dockerfiles/production_kerghan/Dockerfile`;
  `docker-compose.yml`'s `base_prod_build` uses the same path.
- `scripts/bump_version.sh` pins the release version in README, both `package.json`s, the standalone
  CLI and the installer (macOS `sed -i ''`).
- Current version is 0.6.0 (README/package.json); the next release is 0.6.1.

## Steps

- [01 — Rename the release Dockerfile and add the thin Render Dockerfile](infra/01-rename-and-thin-dockerfile.md)
- [02 — Bump the thin Dockerfile's version](infra/02-bump-version.md)
- [03 — Revert the deploy scripts to the branch flow with a version guard](infra/03-deploy-scripts.md)
- [04 — Update the docs](infra/04-docs.md)

## CI Checks
- `scripts/`: `docker-compose run --rm scripts_tests` (CI job: `scripts_tests`, required by
  `build-and-release`)
- Shell lint of changed scripts follows the repo's existing conventions (shellcheck-clean, as the
  current `scripts/` files are).

## Notes
- No Render dashboard change: the service's Dockerfile path stays
  `./dockerfiles/production_kerghan/Dockerfile`. Any manual Render action is done by the user.
- `production_kerghan-base` (image name, `version` entry, `bin/image.sh`, the
  `release-production_kerghan-base(-arm64)` jobs) is out of scope and must not be renamed.
- Rollback is out of scope: `deploy_image` is removed, not reworked.
- Production recovers on the first release with this fix (0.6.1); 0.6.0 cannot be redeployed
  (its tag carries the image-deploy scripts). The user smoke-tests that release.
- The PATCH of the branch may itself trigger an auto-deploy; CI watches the deploy id returned by
  its own POST, as the pre-#341 flow did, so that is harmless.
