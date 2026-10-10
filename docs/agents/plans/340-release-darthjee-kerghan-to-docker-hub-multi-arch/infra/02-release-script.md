# Release script for darthjee/kerghan

Add `bin/release_kerghan.sh`. It follows the style of `bin/image.sh` (bash, small functions, a
`case` on the action). It is kept separate because `bin/image.sh` is built around the `*-base` images
(`version` file tags, `-arm64` suffix, skip-if-unchanged guard), and none of that applies here.

Behaviour:
1. Require `CIRCLE_TAG`: fail with a clear message when it is empty. This is a safety net, since the
   job is already tag-only. There is no skip-if-unchanged guard.
2. Read the base version from the `version` file: `production_kerghan-base=<ver>`. Reuse the same
   grep/sed approach as `image_version` in `bin/image.sh`.
3. Set up QEMU (`docker run --privileged --rm tonistiigi/binfmt --install all`) and a
   `docker-container` buildx builder (`docker buildx create --use`).
4. `echo "$DOCKER_HUB_PASSWORD" | docker login -u "$DOCKER_HUB_USERNAME" --password-stdin`.
5. Build and push in one go:

   ```bash
   docker buildx build --platform linux/amd64,linux/arm64 \
     -f dockerfiles/production_kerghan/Dockerfile \
     --build-arg "BASE_VERSION=$base_version" \
     -t "$DOCKER_ID_USER/kerghan:$CIRCLE_TAG" \
     -t "$DOCKER_ID_USER/kerghan:latest" \
     --push .
   ```

6. Print `docker buildx imagetools inspect "$DOCKER_ID_USER/kerghan:$CIRCLE_TAG"`, so the CI log shows
   both platforms.

Use `set -euo pipefail` (or `set -e` plus explicit checks) so that any failure fails the job.
Make the file executable.

## Files to Change
- `bin/release_kerghan.sh` — new: multi-arch buildx release of `darthjee/kerghan` under `<CIRCLE_TAG>` and `latest`.
