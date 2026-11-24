# Issue: Fix release

## Description

In the last release (0.10.1) the CircleCI job `release-kerghan-standalone`, step `Release darthjee/kerghan-standalone`, failed with `darthjee/kerghan:0.10.1 is amd64, expected arm64.` (exit status 1).

### Failure logs
<details>
<summary>Failure logs</summary>

```
Unable to find image 'tonistiigi/binfmt:latest' locally
latest: Pulling from tonistiigi/binfmt
0c46aa6e9c41: Pull complete 
56685a25fbf3: Pull complete 
44136fa355b3: Download complete 
76bf583f0cc9: Download complete 
c9e92217fbff: Download complete 
Digest: sha256:400a4873b838d1b89194d982c45e5fb3cda4593fbfd7e08a02e76b03b21166f0
Status: Downloaded newer image for tonistiigi/binfmt:latest
installing: arm64 OK
installing: arm OK
installing: s390x OK
installing: ppc64le OK
installing: riscv64 OK
installing: mips64le OK
installing: mips64 OK
installing: loong64 OK
{
  "supported": [
    "linux/amd64",
    "linux/amd64/v2",
    "linux/amd64/v3",
    "linux/amd64/v4",
    "linux/arm64",
    "linux/riscv64",
    "linux/ppc64le",
    "linux/s390x",
    "linux/386",
    "linux/mips64le",
    "linux/mips64",
    "linux/loong64",
    "linux/arm/v7",
    "linux/arm/v6"
  ],
  "emulators": [
    "jar",
    "llvm-14-runtime.binfmt",
    "python3.10",
    "qemu-aarch64",
    "qemu-arm",
    "qemu-loongarch64",
    "qemu-mips64",
    "qemu-mips64el",
    "qemu-ppc64le",
    "qemu-riscv64",
    "qemu-s390x"
  ]
}
relaxed_shaw

WARNING! Your credentials are stored unencrypted in '/home/circleci/.docker/config.json'.
Configure a credential helper to remove this warning. See
https://docs.docker.com/go/credential-store/

Login Succeeded
0.10.1: Pulling from ********/*******
ce928160acb3: Pull complete 
3fe3f62c854c: Pull complete 
69245854ad58: Pull complete 
9bab93d346cd: Pull complete 
a7a274b00007: Pull complete 
d6c30932f8d3: Pull complete 
581998eadfc8: Pull complete 
65779781643c: Pull complete 
f860796ce761: Pull complete 
4f4fb700ef54: Pull complete 
3e6382e9a3cf: Pull complete 
fa4ff5f8381e: Pull complete 
6abee165a8fa: Pull complete 
59b6c23ef1b8: Pull complete 
178e7d0aae9a: Pull complete 
338554e9113f: Pull complete 
44136fa355b3: Already exists 
e4b50a2637dc: Download complete 
Digest: sha256:8b34c69c7494867a0d4b9e019d1e4345a53f6d1396b6a11c7e64884a2224e8d6
Status: Downloaded newer image for ********/*******:0.10.1
docker.io/********/*******:0.10.1
8.4.11: Pulling from library/mysql
20c0ff10f322: Pull complete 
14bd63617e6b: Pull complete 
97347cf073b1: Pull complete 
b110fcfe52b1: Pull complete 
b6ce9cfb6944: Pull complete 
d0655aa7539d: Pull complete 
9b52f53ddec8: Pull complete 
f46a6a1ad729: Pull complete 
13f4feb2e08a: Pull complete 
030f700852e5: Pull complete 
564cc934d6de: Download complete 
776e9ec3533d: Download complete 
Digest: sha256:0f51e63e537a1f176423fa03ef559aabe6fa4372a53160a44bc7e75da7d15364
Status: Downloaded newer image for mysql:8.4.11
docker.io/library/mysql:8.4.11
9.3.0: Pulling from library/mysql
a0ab11061beb: Pull complete 
36af822b21e5: Pull complete 
82954a2a5cc3: Pull complete 
fd23d224f5e0: Pull complete 
62efe2b176c9: Pull complete 
d63fd583f69a: Pull complete 
ca070ddf1d20: Pull complete 
7415b6255bc3: Pull complete 
58e04d708861: Pull complete 
c334fa4b946c: Pull complete 
7597a15a83b9: Download complete 
ff2ba17c5b71: Download complete 
Digest: sha256:b9d8b7ec6e6aced08b1cfe50776f8e323c0a625adf4e10e69f90fc686ea10807
Status: Downloaded newer image for mysql:9.3.0
docker.io/library/mysql:9.3.0
1.0.3: Pulling from ********/tent
7e73988ae5c9: Pull complete 
ecc510c1e359: Pull complete 
7a19dc4d0e05: Pull complete 
4633f536ccde: Pull complete 
0822cfc31c02: Pull complete 
53a3637988ce: Pull complete 
c957944e4676: Pull complete 
cdee7d186a1a: Pull complete 
91a915c3f3cf: Pull complete 
65728ce64758: Pull complete 
65274bb22729: Pull complete 
73a3ba14a4da: Pull complete 
ad8ed65f6f23: Pull complete 
43c20d67cf18: Pull complete 
c0cce1264d37: Pull complete 
4f4fb700ef54: Pull complete 
1c4f36730b54: Pull complete 
0122590e7dd2: Pull complete 
f17f499ee3dd: Pull complete 
ddd7d2b003e1: Pull complete 
Digest: sha256:9a3ea684f00be8862eb07b8826d9df0c6e6571064074ce483ada209770c514f2
Status: Downloaded newer image for ********/tent:1.0.3
docker.io/********/tent:1.0.3
0.10.1: Pulling from ********/*******
f59e747f549e: Pull complete 
df8af2c9772e: Pull complete 
2fbfddd38e16: Pull complete 
7728ed59d665: Pull complete 
e849651a5e80: Pull complete 
58d88f0873b8: Pull complete 
cbb300aa6d3f: Pull complete 
92caadca69c9: Pull complete 
ab625de4e88d: Pull complete 
d832977b1fdf: Pull complete 
be4231ec53a2: Pull complete 
4f4fb700ef54: Pull complete 
dfb705a1d993: Pull complete 
a31a98848e2c: Pull complete 
2ad4c5aa878c: Pull complete 
2d2659f8f8ad: Pull complete 
44136fa355b3: Already exists 
b94851d36986: Download complete 
Digest: sha256:8b34c69c7494867a0d4b9e019d1e4345a53f6d1396b6a11c7e64884a2224e8d6
Status: Image is up to date for ********/*******:0.10.1
docker.io/********/*******:0.10.1
********/*******:0.10.1 is amd64, expected arm64.

Exited with code exit status 1

```

</details>

## Problem

#580 (commit `38669ebc19a110db6a19f033abb68af8dc0f88ab`) assumed the arm64 variant of `darthjee/kerghan` held amd64 content, and fixed the base images. That was not what made the check fail. The published images are correct:

```
$ docker buildx imagetools inspect darthjee/kerghan:<tag> --format '{{range $p, $i := .Image}}{{$p}} -> {{$i.Architecture}}{{"\n"}}{{end}}'
linux/amd64 -> amd64
linux/arm64 -> arm64
```

This holds for `0.9.0`, `0.10.0` and `0.10.1`. The false positive comes from the check itself, `save_image` in `bin/release_kerghan_standalone.sh`:

```bash
docker pull --platform "linux/$arch" "$image"
actual=$(docker image inspect -f '{{.Architecture}}' "$image")
```

The script assumes the **classic** image store, where pulling the same tag for another platform replaces the local copy (see the comment above `save_images`). The logs show the CI Docker now uses the **containerd image store**:

- the pull output has `Download complete` lines, which the containerd store prints;
- the arm64 pull fetches different layers but ends with `Image is up to date` and the same index digest (`sha256:8b34c69c…`). The local image is the multi-platform index, now holding both platforms. It is not replaced.

With the containerd store, `docker image inspect` without `--platform` reports the host platform (amd64). So the check fails for arm64 even though the arm64 content is present and correct. The amd64 checks (and the amd64-only MySQL/Tent pulls) pass because amd64 is the host platform.

`0.9.0` released fine, so the switch most likely happened on CircleCI's `ubuntu-2204:current` machine image between 0.9.0 and 0.10.0 (a newer Docker that defaults to the containerd store). The `docker save` step that follows is affected too: with the containerd store, `docker save` without `--platform` exports every platform held locally, so the per-arch tarballs would no longer be single-arch.

## Expected Behavior

- `release-kerghan-standalone` passes on CircleCI's `ubuntu-2204` machine executor whichever Docker image store it uses (classic or containerd).
- The architecture check in `save_image` only fails when the image really lacks a `linux/<arch>` variant (or is the wrong architecture), never because of how the local store reports a multi-platform image.
- Each `standalone/images/<arch>/*.tar` holds exactly one architecture, tagged with the `repo:tag` the offline image's `/vault/.env` and compose file expect.
- The 0.10.2 release completes end to end: `darthjee/kerghan-standalone:0.10.2` / `0.10.2-offline`, `latest` / `latest-offline` promotion, and the GitHub release assets.

## Solution

Make `save_image` in `bin/release_kerghan_standalone.sh` work the same on both image stores by pulling each architecture **by its per-platform manifest digest** instead of by tag plus `--platform`:

1. Read the `linux/<arch>` manifest digest of `<image>` from the registry with `docker buildx imagetools inspect --format '{{json .Manifest}}'`, and select it with `jq` (preinstalled on CircleCI's `ubuntu-2204` machine images). Plain Go templates don't work here. On a single-platform manifest, `.Manifest.Manifests` errors out, and field access such as `.Manifest.MediaType` silently falls back to the default human-readable output (checked locally). Attestation entries (`unknown/unknown`) are skipped. Fail clearly if the image has no `linux/<arch>` manifest.
2. `docker pull <repo>@<digest>`. A single-platform manifest gives a single-platform local image on either store.
3. `docker tag <repo>@<digest> <image>`, so the tarball keeps the `repo:tag` reference the offline image's `docker load` relies on. On the containerd store this re-points the tag at the single-platform manifest, replacing the index pulled earlier, if any.
4. Keep the `docker image inspect -f '{{.Architecture}}'` check. It is now meaningful, because the local image is single-platform.
5. `docker save <image>` as today. The tarball now holds only `<arch>`.

Sketch:

```bash
# Multi-platform index: the linux/<arch> entry (variant and attestations ignored).
# Single-platform manifest (e.g. darthjee/tent:<v>-arm64): the reference's own digest.
digests=$(docker buildx imagetools inspect "$image" --format '{{json .Manifest}}' \
  | jq -r --arg a "$arch" '
      if .manifests
      then [.manifests[] | select(.platform.os == "linux" and .platform.architecture == $a) | .digest]
      else [.digest]
      end | .[]')
# exactly one sha256:<64 hex> digest, otherwise fail (none: "<image> has no linux/<arch> manifest")
digest=$digests
docker pull "${image%:*}@$digest"
docker tag "${image%:*}@$digest" "$image"
```

The MySQL, MySQL-legacy and Tent pulls go through the same function, so they get the same treatment. Update the "classic image store" comment above `save_images` to say the function no longer depends on the store type.

Also log the daemon's storage driver and Docker version at the start of `release` (e.g. `docker version` and `docker info -f '{{.Driver}} {{.DriverStatus}}'`), so a future store change shows up in the CI log right away.

### Alternatives considered

- **`--platform` on `docker image inspect` / `docker save`**: the smallest diff, but it depends on a recent Docker (about 28.x), and how these flags behave on the classic store is unverified.
- **Forcing the classic store** (turning off `containerd-snapshotter` in `daemon.json` and restarting dockerd in CI): works against the host defaults and is fragile.
- **Pinning an older `ubuntu-2204` machine image**: only buys time.

### Edge cases

Checked against the images the release actually bundles:

| Image | Registry shape | Notes |
|---|---|---|
| `darthjee/kerghan:<tag>` | multi-platform index (amd64, arm64) | normal case |
| `mysql:8.4.11`, `mysql:9.3.0` | multi-platform index | arm64 is listed as `linux/arm64` **variant `v8`**, plus `unknown/unknown` attestation entries |
| `darthjee/tent:1.0.3` / `darthjee/tent:1.0.3-arm64` | **single-platform manifests** (`manifest.v2`, not an index), amd64 and arm64 respectively | `.Manifest.Manifests` does not exist (a Go template over it errors out). The `jq` selection falls back to the reference's own digest |

What the implementation must handle:

- **Single-platform images (Tent).** When the reference is a plain manifest, not an index, use the reference's own digest instead of selecting one from `.Manifest.Manifests`. The `docker image inspect` architecture check after the pull still rejects a wrong-arch image (e.g. if someone mapped amd64 to an arm64-only tag). The per-arch tag mapping (`tent_image_for` and the Dockerfile's `TENT_IMAGE` stamp) is unchanged.
- **Variants.** Match on `os` + `architecture` only and ignore `variant`, so `arm64/v8` matches `arm64`.
- **Attestations.** `unknown/unknown` entries never match, since the OS is not `linux`.
- **No match or ambiguous match.** Check that exactly one `sha256:<64 hex>` digest was selected. Fail with `<image> has no linux/<arch> manifest` when none is found, and with a separate message when several are, instead of passing a glued-together string to `docker pull`.
- **Tag inside the tarball.** After `docker pull <repo>@<digest>`, `docker tag` restores `<repo>:<tag>` (e.g. `darthjee/tent:1.0.3-arm64`), so `docker load` in the offline image yields the names `/vault/.env` and the compose file expect. On the containerd store the tag now points at the single-platform manifest, so `docker save` exports only that arch. The loop handles one arch at a time and saves before moving on, so re-pointing the tag between arches is safe.
- **`docker load` of containerd-store tarballs.** `docker save` from the containerd store writes an OCI layout that also has the legacy `manifest.json`, so the inner daemon loads it whatever its store. The existing offline smoke test (inner `docker image inspect` of each preloaded image by name) is the check for this. Only amd64 is smoke-tested; arm64 tarballs are covered by the inspect check before saving.
- **Reference parsing.** `${image%:*}` is fine for every image used here (no registry host with a port). Note the assumption in a comment rather than generalizing.

### Scope

In scope:

- `save_image` in `bin/release_kerghan_standalone.sh`: pull by per-platform digest, tag, check the architecture, save (see Solution).
- The updated comment above `save_images`.
- Docker version and storage-driver logging at the start of `release`.
- Bats coverage for `save_image` and the infra docs update (see Testing and Ownership and docs).

Out of scope:

- **The #580 changes stay as they are.** These are `darthjee/node` 0.3.0, `darthjee/scripts` 0.15.0, base images 0.1.2, the rsync pin, and `yarn_builder` as root for `circleci_kerghan-base`. They are valid upgrades (`darthjee/node` 0.2.1 really is amd64-only), but they were **not** the cause of the `is amd64, expected arm64` failure. If this symptom comes back, start from the image-store behavior above, not from the base images.
- Everything else in the release pipeline. Only `save_image` uses the `pull --platform` + `image inspect` + `save` pattern. The smoke test (`docker pull --platform linux/amd64` of the offline image on the amd64 host, plus inner-daemon lookups by name) behaves the same on both stores.

### Testing

- **Bats coverage** for `save_image` under `scripts/test/` (run by the existing `scripts_tests` CI job), with a stubbed `docker` in the same style as the `scripts/deploy.sh` tests. The stub returns canned `imagetools inspect --format '{{json .Manifest}}'` output and records the `pull`/`tag`/`save` calls. Cases:
  - multi-platform index: pulls `<repo>@<linux/arch digest>`, tags `<image>`, saves to `standalone/images/<arch>/<name>.tar`;
  - single-platform manifest (Tent shape): uses the reference's own digest;
  - `arm64` with variant `v8`: matches; `unknown/unknown` attestation entries never match;
  - no `linux/<arch>` entry: fails with `<image> has no linux/<arch> manifest`, and nothing is pulled or saved;
  - several matching entries: fails, and nothing is pulled;
  - `docker image inspect` reports another architecture: fails with `<image> is <actual>, expected <arch>.`, and nothing is saved.

  The script may need a small guard (e.g. only run the `case $ACTION` dispatch when executed, not when sourced) so the tests can source it and call `save_image` directly.
- **End to end**: the 0.10.2 release (see Release handling).

### Ownership and docs

- Owner: **infra** agent (`bin/` CI scripts, CircleCI release jobs, `scripts/test/`).
- Update `docs/agents/architecture/infra/releases.md` (the `release-kerghan-standalone` section) to describe the per-arch digest pull and why it doesn't depend on the image store. Update `docs/agents/standalone/inner-stack.md` too if its tarball description mentions pulling by tag.

### Release handling

The 0.10.1 release is incomplete: `darthjee/kerghan:0.10.1` was published (and Render can deploy from it), but `darthjee/kerghan-standalone:0.10.1` / `0.10.1-offline` and the GitHub release assets were not. The 0.10.1 tag is **not** re-run. Once this fix is merged, a new **0.10.2** release is cut through the normal version bump. That release is the end-to-end check for this fix. Standalone users go straight from 0.10.0 to 0.10.2, and nothing needs to be cleaned up for 0.10.1.

## Benefits

- Unblocks the standalone release (0.10.0 and 0.10.1 both failed at this step).
- The release no longer depends on which image store the CI machine image happens to default to.
- Records that #580 misread the cause, so the same symptom isn't chased into the base images again.
