# Pull per-arch images by digest in save_image

Rewrite `save_image` in `bin/release_kerghan_standalone.sh` so it no longer depends on the Docker image store.

1. **Digest lookup.** Add a helper (e.g. `platform_digest <arch> <image>`) that runs `docker buildx imagetools inspect "$image" --format '{{json .Manifest}}'` and selects digests with the `jq` filter in [../infra.md](../infra.md#context):
   - index / manifest list: the `manifests[]` entries with `platform.os == "linux"` and `platform.architecture == <arch>` (variant ignored, so `arm64/v8` matches; `unknown/unknown` attestations never match);
   - single-platform manifest: the manifest's own `digest`.
2. **Validation.** Exactly one value matching `^sha256:[0-9a-f]{64}$` must come back:
   - none: `echo "$image has no linux/$arch manifest." >&2; exit 1`;
   - more than one: a distinct error (e.g. `"$image has several linux/$arch manifests."`), exit 1.
   - Nothing is pulled in either case.
3. **Pull and tag.**
   - `docker pull "${image%:*}@$digest"`.
   - `docker tag "${image%:*}@$digest" "$image"`, so the tarball keeps the `repo:tag` the offline image expects (e.g. `darthjee/tent:1.0.3-arm64`).
   - Drop `--platform` from the pull: the digest already selects the platform.
4. **Architecture check.** Keep `docker image inspect -f '{{.Architecture}}' "$image"` and the `"$image is $actual, expected $arch."` error unchanged. It is meaningful again because the local image is single-platform.
5. **Save.** `docker save "$image" -o "$IMAGES_DIR/$arch/$name.tar"`, unchanged.
6. **Comments.** Replace the "with the classic image store a new pull of the same tag replaces the local copy" comment above `save_images`. Explain that pulling by per-platform digest gives a single-platform local image on both the classic and the containerd store, which is why the check and `docker save` are per-arch. Also note the `${image%:*}` assumption (no registry host with a port).
7. **Store logging.** At the start of `release`, after `setup_builder`, log `docker version` and `docker info -f '{{.Driver}} {{json .DriverStatus}}'` (the latter best-effort, `|| true`), so the image store in use shows in the CI log.
8. **Sourceable script.** Guard the `ACTION` / `case` dispatch at the bottom so it only runs when the file is executed, not sourced. For example, wrap it in `if [ "${BASH_SOURCE[0]}" = "$0" ]; then ... fi`. Step 02's tests can then `source` the script and call `save_image` directly. `set -euo pipefail` at the top stays as is. Executing the script with `release` or with no or unknown arguments must behave exactly as before.

## Files to Change

- `bin/release_kerghan_standalone.sh`: `platform_digest` helper, rewritten `save_image`, updated `save_images` comment, Docker store logging in `release`, sourced-vs-executed guard around the dispatch.
