# Issue: Refactor: consolidate the four near-identical *-base Dockerfiles

## Description
`dockerfiles/kerghan-base`, `vite_kerghan-base`, `production_kerghan-base` and `circleci_kerghan-base` share the same multi-stage skeleton (`darthjee/scripts` stage → `base` → `builder` running `yarn_builder.sh` → final stage copying the yarn cache from the builder).

## Problem
The four files repeat the same skeleton and the same version pins, so bumping any one requires editing several files (recent commits #107/#108 had to touch all of them for pins and apt versions). The repeated pins are `darthjee/scripts:0.8.0`, `darthjee/node:0.2.1`, and the `rsync` apt pin (`3.2.7-1+deb12u6` in `kerghan-base` and `vite_kerghan-base`; a different Ubuntu-specific `3.2.7-0ubuntu0.22.04.7` in `circleci_kerghan-base`; none in `production_kerghan-base`).

The files are not just parameter-swaps of each other. Besides base image (`darthjee/node` vs `darthjee/circleci_node`), user (`node` vs `circleci`), home/app dir, source dir (`backend/` vs `frontend/`), rsync and final `CMD`, they also differ structurally:
- `package.json`/`yarn.lock` are copied in the `base` stage for `kerghan-base`/`vite_kerghan-base` (so they end up in the final image) but only in the `builder` stage for `circleci_kerghan-base`/`production_kerghan-base` (so they don't).
- The `builder` stage runs as `root` in `kerghan-base`/`vite_kerghan-base` and as the app user in the other two.
- The yarn-cache destination is `/usr/local/share/.cache/yarn/v6/` for the node images but `/home/circleci/.cache/yarn/v6/` for circleci.
- The `CMD` sits in the `base` stage for production and in the final stage for the others (`kerghan-base`: `yarn build %%PROBLEM%%%%PROBLEM%% node dist/main.js`; `vite_kerghan-base`: `npm run server`; `circleci_kerghan-base`: none).

Also relevant to the approach: `bin/image.sh` builds each image with `-f dockerfiles/$image/Dockerfile` and its `skip_if_unchanged` guard diffs only `dockerfiles/${image}/`. The base images are not built by `docker-compose.yml` (compose only builds the leaf `kerghan`, `production_kerghan` and `vite_kerghan` images) — they are built via `bin/image.sh`, the Makefile and the CircleCI `release-image` job.

## Expected Behavior
The four base images are produced from a single parameterised Dockerfile with each version pin defined once. The published image names/tags stay the same and the images keep working for their consumers (the leaf Dockerfiles built from them, and the CircleCI jobs that run on `circleci_kerghan-base`/`vite_kerghan-base`). Small incidental structural differences between the four (see Problem) may be normalised to a uniform structure, so exact image contents are not required to be byte-identical — but any resulting change (e.g. whether `package.json`/`yarn.lock` remain in the final image, which user the builder stage runs as) must be checked and shown not to break those consumers.

## Solution
- Add one shared Dockerfile at `dockerfiles/base/Dockerfile` (replacing the four per-image Dockerfiles) with a uniform stage structure, parameterised by build args such as `BASE_IMAGE`, `USER_NAME`, `APP_DIR`, `SOURCE_DIR`, `YARN_CACHE_DIR`, `RSYNC_VERSION` and `CMD`.
- `bin/image.sh` maps each image name to its `--build-arg` set (single place for the `darthjee/scripts` and `darthjee/node` pins); `RSYNC_VERSION` is per image (Debian pin for `kerghan-base`/`vite_kerghan-base`, Ubuntu pin for `circleci_kerghan-base`, empty ⇒ rsync not installed for `production_kerghan-base`), each defined once.
- Update `bin/image.sh`'s build path and its `skip_if_unchanged` guard so a change to the shared Dockerfile or to an image's arg set rebuilds the affected images (a change to the shared Dockerfile rebuilds all four); keep the `Makefile` targets and the CircleCI `release-image` job working, and update docs that describe the per-image Dockerfiles (e.g. `docs/agents/folder-structure.md`, `.claude/agents/infra.md`).
- Verify by building all four images via `bin/image.sh build <image>` (and the Makefile targets), then checking the leaf images (`kerghan`, `production_kerghan`, `vite_kerghan`) still build from them and that `circleci_kerghan-base`/`vite_kerghan-base` still serve their CircleCI jobs.
- Out of scope: the `darthjee/scripts:0.8.0` pin repeated in the three leaf Dockerfiles (a follow-up).

## Benefits
One place to bump a base image or apt pin, and less drift between the images over time.
