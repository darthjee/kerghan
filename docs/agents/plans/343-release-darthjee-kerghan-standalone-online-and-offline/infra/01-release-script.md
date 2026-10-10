# Release script

Add `bin/release_kerghan_standalone.sh` (executable), modeled on `bin/release_kerghan.sh`:
`set -euo pipefail`, `require_tag`, `setup_builder` (binfmt + `docker buildx create --use`),
`login`, and a `release` subcommand.

`IMAGE=kerghan-standalone`, `PLATFORMS=linux/amd64,linux/arm64`,
`repo="$DOCKER_ID_USER/$IMAGE"`, `version=$CIRCLE_TAG`.

`release`:

1. **save_images**: for each `arch` in `amd64 arm64`:
   - clear and recreate `standalone/images/$arch/`;
   - pick the Tent tag: `darthjee/tent:1.0.3` for amd64, `darthjee/tent:1.0.3-arm64` for arm64.
   - For each of `darthjee/kerghan:$version`, `mysql:9.3.0` and that Tent tag:
     - `docker pull --platform linux/$arch <img>`;
     - check that `docker image inspect -f '{{.Architecture}}' <img>` equals `$arch`, and fail
       otherwise;
     - `docker save <img> -o standalone/images/$arch/<name>.tar`.

   Pull and save one architecture before moving to the next. With the classic image store, a
   new pull of the same tag replaces the local copy.
2. **build_push**: run `docker buildx build --platform "$PLATFORMS" -f
   dockerfiles/kerghan_standalone/Dockerfile --build-arg "KERGHAN_VERSION=$version" --push .`
   twice:
   - `--target standalone -t "$repo:$version"`;
   - `--target standalone-offline -t "$repo:$version-offline"`.

   The second build reuses the cached frontend and online layers.
3. **smoke**: run `IMAGE="$repo:$version-offline" SKIP_BUILD=true KERGHAN_VERSION="$version"
   SMOKE_EXPECT_OFFLINE=true standalone/scripts/smoke_test.sh`. It pulls the amd64 image.
4. **promote**:
   - `docker buildx imagetools create -t "$repo:latest" "$repo:$version"`;
   - `docker buildx imagetools create -t "$repo:latest-offline" "$repo:$version-offline"`.
5. Run `docker buildx imagetools inspect` on all four tags, so the log shows both platforms.

## Files to Change

- `bin/release_kerghan_standalone.sh`: new release script.
