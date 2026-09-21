# Infra Plan: Refactor: consolidate the four near-identical *-base Dockerfiles

Main plan: [plan.md](plan.md)

## Overview
Today four Dockerfiles (`kerghan-base`, `circleci_kerghan-base`, `production_kerghan-base`, `vite_kerghan-base`) repeat the same skeleton (`scripts` stage → `base` → `builder` running `yarn_builder.sh` → final stage copying the yarn cache) and the same pins (`darthjee/scripts:0.8.0`, `darthjee/node:0.2.1`, rsync). This plan replaces them with one shared `dockerfiles/base/Dockerfile` that:

- declares the `darthjee/scripts` and `darthjee/node`/`circleci_node` version pins **once**, as `ARG` defaults;
- takes the per-image differences as build args supplied by `bin/image.sh` (one arg set per image name);
- normalises the incidental structural differences (see "Normalisation decisions" below);
- ends with one thin named target per image so each keeps its own exec-form `CMD`, selected with `docker build --target <image>`.

Published image names/tags, the Makefile targets and the CircleCI `release-image` job keep working unchanged.

## Context
Decisions taken in the issue discussion (see the issue file): single parameterised Dockerfile; normalising small structural differences is allowed (exact image contents need not be byte-identical, but leaf images and CI consumers must keep working); shared file lives in `dockerfiles/base/` with the per-image args in `bin/image.sh`; rsync stays per-image (Debian pin for `kerghan-base`/`vite_kerghan-base`, Ubuntu pin for `circleci_kerghan-base`, none for `production_kerghan-base`); the `darthjee/scripts:0.8.0` pin in the three **leaf** Dockerfiles (`kerghan`, `vite_kerghan`, `production_kerghan`) is out of scope.

Facts found while exploring:
- The base images are **not** built by `docker-compose.yml` (compose builds only the leaf `kerghan`, `production_kerghan`, `vite_kerghan` images `FROM darthjee/<x>-base:${BASE_VERSION}`); they are built by `bin/image.sh` (`build`/`push`/`qemu`), the `Makefile` `*-base` targets (which just call `bin/image.sh`) and the CircleCI `release-image` job (`bin/image.sh qemu|push <image> [arch]`). So no `docker-compose.yml` change is needed.
- `bin/image.sh` currently builds with `-f dockerfiles/$image/Dockerfile .` and `skip_if_unchanged` only diffs `dockerfiles/${image}/` since the previous tag.
- Leaf Dockerfiles copy their own `package.json`/`yarn.lock`, so they do not depend on the base image already containing them; docker-compose also bind-mounts `./backend` over `/home/node/app` at runtime.
- CI runs `circleci_kerghan-base:0.1.0` (`backend_tests`, `backend_checks`, `coverage-final`) and `vite_kerghan-base:0.1.0` (`upload_fe_files`, `release`) with a `checkout` step into the executor's default working directory. Each job pins the image tag from the root `version` file.

### Per-image parameters (single source: the arg map in `bin/image.sh`)

| Image (= `--target`) | `BASE_IMAGE` | `USER_NAME` | `HOME_DIR` | `APP_DIR` | `SOURCE_DIR` | `YARN_CACHE_DIR` | `RSYNC_VERSION` | `CMD` (in target stage) |
|---|---|---|---|---|---|---|---|---|
| `kerghan-base` | `darthjee/node` | `node` | `/home/node` | `/home/node/app` | `backend` | `/usr/local/share/.cache/yarn/v6` | `3.2.7-1+deb12u6` | `["sh", "-c", "yarn build && node dist/main.js"]` |
| `vite_kerghan-base` | `darthjee/node` | `node` | `/home/node` | `/home/node/app` | `frontend` | `/usr/local/share/.cache/yarn/v6` | `3.2.7-1+deb12u6` | `["npm", "run", "server"]` |
| `production_kerghan-base` | `darthjee/node` | `node` | `/home/node` | `/home/node/app` | `backend` | `/usr/local/share/.cache/yarn/v6` | *(empty ⇒ not installed)* | `["node", "dist/main.js"]` |
| `circleci_kerghan-base` | `darthjee/circleci_node` | `circleci` | `/home/circleci` | `/home/circleci/project` | `backend` | `/home/circleci/.cache/yarn/v6` | `3.2.7-0ubuntu0.22.04.7` | *(none)* |

Version pins defined once as `ARG` defaults in the shared Dockerfile: `SCRIPTS_IMAGE=darthjee/scripts:0.8.0` and `NODE_IMAGE_VERSION=0.2.1` (used for both `darthjee/node` and `darthjee/circleci_node`, which are both pinned to `0.2.1` today).

### Normalisation decisions
- **`package.json`/`yarn.lock` copied in the `builder` stage only, for all four images.** Today `kerghan-base`/`vite_kerghan-base` copy them in the `base` stage (they end up in the final image) while `circleci_kerghan-base`/`production_kerghan-base` copy them only in `builder`. Builder-only is the safer direction: baking `package.json` into `circleci_kerghan-base`'s `/home/circleci/project` could interfere with CircleCI's `checkout` into that directory, whereas the leaf images and compose do not need it in the base. Effect: `kerghan-base`/`vite_kerghan-base` final images no longer contain `package.json`/`yarn.lock` in `/home/node/app`.
- **`builder` stage runs as `$USER_NAME`** for all four (production and circleci already do; `kerghan-base`/`vite_kerghan-base` used `root`). Must be verified (yarn cache output identical in content) in Step 04; fall back to `root` for the node images via an arg only if it proves necessary.
- **`ENV HOME_DIR` set in the final stage for all four** (was missing from `circleci_kerghan-base`); harmless.
- The `USER root` step exists only to run the (conditional) rsync install; each final stage ends with `USER $USER_NAME`.

## Steps

- [01 — Create the shared base Dockerfile](infra/01-create-shared-dockerfile.md)
- [02 — Wire bin/image.sh to the shared Dockerfile](infra/02-wire-bin-image-sh.md)
- [03 — Remove the four per-image Dockerfiles](infra/03-remove-old-dockerfiles.md)
- [04 — Verify the four images and their consumers](infra/04-verify-images.md)
- [05 — Update documentation](infra/05-update-docs.md)

## CI Checks
- `dockerfiles/`, `bin/`, `Makefile`: no dedicated lint job. These only run on tagged releases (`release-image` jobs); verify locally by building the four images with `bin/image.sh build <image>` (see Step 04) and by reading the `release-image` job in `.circleci/config.yml`.

## Notes
- **Deviation from the issue's suggested `ARG CMD`:** an exec-form `CMD` cannot be parameterised by an `ARG`/`ENV` without going through `sh -c`/`eval`, which would change signal handling (PID 1) for `npm run server`/`node dist/main.js` and mangles `&&` in `kerghan-base`'s command. Per-image final targets keep each `CMD` byte-identical while every other difference stays arg-driven. The issue text only said "such as", so this is within its scope.
- **Change-detection guard:** because the arg sets live in `bin/image.sh` (per the discussion), `skip_if_unchanged` must diff both `dockerfiles/base/` and `bin/image.sh`, so a change to either rebuilds all four images. This is deliberately conservative (an unrelated edit to `bin/image.sh` triggers a rebuild on the next tag); more precise per-image detection would need the arg sets stored per image, which was not chosen.
- **`version` file:** image contents change slightly (see normalisation). Do not bump `version`/CI image pins as part of this refactor unless the implementer finds the repo convention requires it (`git log -- version` shows how #107/#108's Dockerfile-only changes were handled); flag it in the PR description.
- **Host tooling rule:** the image builds necessarily run `docker` directly via `bin/image.sh`; do not run `yarn`/`npm`/`php` on the host. `bin/image.sh build` needs `DOCKER_ID_USER` exported.
- `.circleci/config.yml` also pins `darthjee/circleci_node:0.2.1` for the `jasmine`/`frontend-checks` jobs; that is a separate pin and stays out of scope.
- The stale TODO comment about a production-only-deps flag in `production_kerghan-base/Dockerfile` should be carried into the shared file only if still relevant (it is about `yarn_builder.sh` flags, not about this refactor) — keep it as a short comment on the builder step.
