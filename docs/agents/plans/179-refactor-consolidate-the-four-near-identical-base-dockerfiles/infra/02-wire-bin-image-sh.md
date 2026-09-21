# Wire bin/image.sh to the shared Dockerfile
Make `bin/image.sh` build every base image from `dockerfiles/base/Dockerfile` with its own args and target, and make the unchanged-guard aware of the shared file.

- Add a `build_args()` function (a `case "$image"` over the four image names) that echoes the `--build-arg` set for the image, per the parameter table in [infra.md](../infra.md) (`BASE_IMAGE`, `USER_NAME`, `HOME_DIR`, `APP_DIR`, `SOURCE_DIR`, `YARN_CACHE_DIR`, `RSYNC_VERSION`). Unknown image names must exit non-zero with a clear message (rather than building with empty args). The `darthjee/scripts` and `darthjee/node` version pins are NOT here — they live only as `ARG` defaults in the shared Dockerfile.
- In `build()`, replace `-f "dockerfiles/$image/Dockerfile"` with `-f dockerfiles/base/Dockerfile --target "$image"` plus the args from `build_args`. Keep the surrounding tag/cached-tag/`docker rmi` handling untouched. Beware quoting: build the args as a bash array (e.g. `read -r -a args <<< "$(build_args "$image")"`, or fill an array directly) so values like `3.2.7-1+deb12u6` and paths stay single words.
- In `skip_if_unchanged()`, diff both `dockerfiles/base/` and `bin/image.sh` (`git diff --quiet "$prev_tag"..HEAD -- dockerfiles/base/ bin/image.sh`) instead of `dockerfiles/${image}/`, and update the "No changes in …" message accordingly. This is the conservative option chosen for keeping the arg sets in the script.
- Keep `qemu`, `push`, `image_version` and the `ACTION` dispatch unchanged; `Makefile` targets and the CircleCI `release-image` job keep calling `bin/image.sh build|push|qemu <image> [arch]` with the same image names, so no change to `Makefile` or `.circleci/config.yml` should be needed — confirm this while implementing.

## Files to Change
- `bin/image.sh` — `build_args()` per-image arg map; `build()` uses the shared Dockerfile + `--target`; `skip_if_unchanged()` diffs the shared Dockerfile dir and the script.
