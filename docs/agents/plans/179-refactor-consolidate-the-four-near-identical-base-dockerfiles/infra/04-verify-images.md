# Verify the four images and their consumers
Confirm the consolidated build produces working images equivalent (modulo the documented normalisations) to the current ones. This step changes no files; record findings in the PR description.

1. **Baseline:** on a clean checkout of `origin/main` (e.g. a separate worktree), build the four images with the old Dockerfiles: `DOCKER_ID_USER=local bin/image.sh build <image>` for `kerghan-base`, `vite_kerghan-base`, `production_kerghan-base`, `circleci_kerghan-base`, and re-tag them (e.g. `:baseline`) before they get overwritten.
2. **New build:** on the issue branch, build the same four with the new `bin/image.sh`. Each must build without warnings about undefined args or missing targets.
3. **Compare** old vs new for each image, e.g. with `docker run --rm --entrypoint sh <img> -c '…'` / `docker image inspect`:
   - `Config.User`, `Config.Cmd`, `Config.Env` (`HOME_DIR`), working dir — must match except for the intended changes (`HOME_DIR` now also set on `circleci_kerghan-base`).
   - `rsync --version` present with the expected pinned version in `kerghan-base`, `vite_kerghan-base`, `circleci_kerghan-base`; **absent** in `production_kerghan-base`.
   - The pre-warmed yarn cache exists at the expected path and has equivalent contents (`/usr/local/share/.cache/yarn/v6/` for the node images, `/home/circleci/.cache/yarn/v6/` for circleci) — this validates the "builder runs as `$USER_NAME`" normalisation for `kerghan-base`/`vite_kerghan-base`; if it fails, add an arg to keep `root` for those two.
   - `package.json`/`yarn.lock` are no longer in `/home/node/app` of `kerghan-base`/`vite_kerghan-base` (documented change) and still absent in `circleci_kerghan-base`/`production_kerghan-base`.
4. **Consumers:**
   - Build the leaf images from the new bases via docker-compose (`docker-compose build base_build base_prod_build kerghan_fe`, with `BASE_VERSION` pointing at the locally built tags) and make sure they build.
   - For `circleci_kerghan-base` and `vite_kerghan-base`, run the commands the CI jobs run against the new image (e.g. the `Set folder` + `yarn install` steps of `backend_tests`/`upload_fe_files` against a mounted copy of the repo) to check the cache is warm and nothing depends on a file that disappeared.
5. **Guard/dispatch:** run `bin/image.sh build bogus-name` (must fail clearly) and `bash -n bin/image.sh`; walk through `skip_if_unchanged` with a temporary tag to confirm that touching `dockerfiles/base/` or `bin/image.sh` triggers a rebuild and untouched trees skip.
6. Confirm `make build-base build-circleci-base build-production-base build-fe-base` (which just call `bin/image.sh`) still work.

## Files to Change
- None (verification only).
