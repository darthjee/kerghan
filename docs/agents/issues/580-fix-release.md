# Issue: Fix release

## Description

In the last release (0.10.0) the CircleCI job `release-kerghan-standalone`, step `Release darthjee/kerghan-standalone`, failed with `darthjee/kerghan:0.10.0 is amd64, expected arm64.` (exit status 1).

## Logs
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
installing: s390x OK
installing: riscv64 OK
installing: loong64 OK
installing: arm64 OK
installing: arm OK
installing: ppc64le OK
installing: mips64le OK
installing: mips64 OK
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
stoic_kare

WARNING! Your credentials are stored unencrypted in '/home/circleci/.docker/config.json'.
Configure a credential helper to remove this warning. See
https://docs.docker.com/go/credential-store/

Login Succeeded
0.10.0: Pulling from ********/*******
c237534654fe: Pull complete 
c8443a297fa4: Pull complete 
5c7975d105a9: Pull complete 
6ae8659f7a8d: Pull complete 
e8d2a98f6bdf: Pull complete 
908ed71b7c85: Pull complete 
b4a0e50dac1a: Pull complete 
7b2e0bbafa0f: Pull complete 
ac38583add90: Pull complete 
92efd96750ec: Pull complete 
a5a187319fa1: Pull complete 
4f4fb700ef54: Pull complete 
a3ed95caeb02: Pull complete 
50286e101cca: Pull complete 
ccd6e8fd85fb: Pull complete 
89b99cbdf81e: Pull complete 
fd4784c0efdd: Pull complete 
44136fa355b3: Already exists 
5cd934f04a39: Download complete 
Digest: sha256:5a38011c54a657bda4a01afbce7737d72240e09d04201ad714b0f6fa5a47ef57
Status: Downloaded newer image for ********/*******:0.10.0
docker.io/********/*******:0.10.0
8.4.11: Pulling from library/mysql
14bd63617e6b: Pull complete 
20c0ff10f322: Pull complete 
d0655aa7539d: Pull complete 
b110fcfe52b1: Pull complete 
030f700852e5: Pull complete 
b6ce9cfb6944: Pull complete 
f46a6a1ad729: Pull complete 
9b52f53ddec8: Pull complete 
13f4feb2e08a: Pull complete 
97347cf073b1: Pull complete 
564cc934d6de: Download complete 
776e9ec3533d: Download complete 
Digest: sha256:0f51e63e537a1f176423fa03ef559aabe6fa4372a53160a44bc7e75da7d15364
Status: Downloaded newer image for mysql:8.4.11
docker.io/library/mysql:8.4.11
9.3.0: Pulling from library/mysql
36af822b21e5: Pull complete 
d63fd583f69a: Pull complete 
62efe2b176c9: Pull complete 
58e04d708861: Pull complete 
a0ab11061beb: Pull complete 
fd23d224f5e0: Pull complete 
82954a2a5cc3: Pull complete 
7415b6255bc3: Pull complete 
c334fa4b946c: Pull complete 
ca070ddf1d20: Pull complete 
7597a15a83b9: Download complete 
ff2ba17c5b71: Download complete 
Digest: sha256:b9d8b7ec6e6aced08b1cfe50776f8e323c0a625adf4e10e69f90fc686ea10807
Status: Downloaded newer image for mysql:9.3.0
docker.io/library/mysql:9.3.0
1.0.3: Pulling from ********/tent
7a19dc4d0e05: Pull complete 
1c4f36730b54: Pull complete 
ad8ed65f6f23: Pull complete 
73a3ba14a4da: Pull complete 
7e73988ae5c9: Pull complete 
43c20d67cf18: Pull complete 
4f4fb700ef54: Pull complete 
65728ce64758: Pull complete 
f17f499ee3dd: Pull complete 
53a3637988ce: Pull complete 
4633f536ccde: Pull complete 
c0cce1264d37: Pull complete 
0822cfc31c02: Pull complete 
91a915c3f3cf: Pull complete 
0122590e7dd2: Pull complete 
c957944e4676: Pull complete 
cdee7d186a1a: Pull complete 
ddd7d2b003e1: Pull complete 
65274bb22729: Pull complete 
ecc510c1e359: Pull complete 
Digest: sha256:9a3ea684f00be8862eb07b8826d9df0c6e6571064074ce483ada209770c514f2
Status: Downloaded newer image for ********/tent:1.0.3
docker.io/********/tent:1.0.3
0.10.0: Pulling from ********/*******
5c7975d105a9: Already exists 
c8443a297fa4: Already exists 
7b2e0bbafa0f: Already exists 
b4a0e50dac1a: Pull complete 
ac38583add90: Already exists 
a3ed95caeb02: Already exists 
ccd6e8fd85fb: Already exists 
4c28c6fcfbf2: Pull complete 
1d208579b738: Pull complete 
4f4fb700ef54: Pull complete 
065beb6e1229: Pull complete 
db8713573c05: Pull complete 
6ae8659f7a8d: Already exists 
e8d2a98f6bdf: Already exists 
c237534654fe: Already exists 
908ed71b7c85: Already exists 
92efd96750ec: Already exists 
b33599709ff8: Download complete 
44136fa355b3: Already exists 
Digest: sha256:5a38011c54a657bda4a01afbce7737d72240e09d04201ad714b0f6fa5a47ef57
Status: Image is up to date for ********/*******:0.10.0
docker.io/********/*******:0.10.0
********/*******:0.10.0 is amd64, expected arm64.

Exited with code exit status 1
```

</details>

## Root cause

Verified against the public Docker Hub registry (manifests and config blobs):

- `darthjee/node:0.2.1` — the `NODE_IMAGE_VERSION` pinned in `dockerfiles/base/Dockerfile` — is a **single-arch amd64 image** (no manifest list, no `-arm64` tag). The multi-arch manifests only start at `darthjee/node:0.2.2` (`amd64` + `arm64`).
- `bin/image.sh build` runs `docker build --platform linux/arm64 ...`, but the `FROM darthjee/node:0.2.1` stage resolves to the amd64 image, so the `production_kerghan-base:0.1.0-arm64` image has **byte-identical layers** to the amd64 one; only the config's `architecture` field is relabelled `arm64`.
- `dockerfiles/release_kerghan/Dockerfile` builds `darthjee/kerghan:<tag>` for arm64 `FROM production_kerghan-base:<ver>-arm64`, so the arm64 entry of the `darthjee/kerghan:0.10.0` manifest list has amd64 content.
- `bin/release_kerghan_standalone.sh` (`save_image`) pulls `darthjee/kerghan:0.10.0` with `--platform linux/arm64`, then inspects the architecture. The local copy still reports `amd64` (the pull printed `Image is up to date` and reused the amd64 layers; exactly why the config isn't replaced is not verified), hence `... is amd64, expected arm64.` and exit 1.

The standalone check did its job: it caught a latent bug that already exists in the published `darthjee/kerghan` arm64 images (earlier releases included), which nothing exercised before the standalone image started consuming the arm64 variant.

## Expected Behavior

- `arm64` and `amd64` are both released, with real arm64 content in the arm64 images.
- Release 0.10.1 is published successfully.

## Scope

**Fix:** bump `NODE_IMAGE_VERSION` in `dockerfiles/base/Dockerfile` from `0.2.1` to `0.3.0`. `darthjee/node:0.3.0` is a real multi-arch manifest list (amd64 + arm64); compared with `0.2.1` it is a Node patch bump (22.21.1 → 22.23.4), with the same Yarn (1.22.22), user and entrypoint.

**In scope**
- Bump the base image pin above. Since `bin/image.sh` rebuilds every base whenever `dockerfiles/base/` changes, **all four** base images (`kerghan-base`, `circleci_kerghan-base`, `production_kerghan-base`, `vite_kerghan-base`) get a new version in `version`, so the broken `<ver>` / `<ver>-arm64` tags are never overwritten.
- Update every reference pinned to the old base versions (e.g. `darthjee/vite_kerghan-base:0.1.0` in `dockerfiles/kerghan_standalone/Dockerfile`, CircleCI executors, docker-compose, `dockerfiles/release_kerghan/Dockerfile` via the `version` file).
- Check that `darthjee/circleci_node:0.3.0` (base of `circleci_kerghan-base`) is also multi-arch before relying on it.
- Release 0.10.1 (via `scripts/bump_version.sh`) with both `amd64` and `arm64` published for `darthjee/kerghan` and `darthjee/kerghan-standalone`.

**Out of scope**
- No change to `save_image`'s architecture check in `bin/release_kerghan_standalone.sh`; it is working as intended.
- No guard against a future single-arch `FROM` image (decided: not now).
- Already published images (`darthjee/kerghan:0.10.0` and earlier, and their mislabelled arm64 variants) are left as they are; 0.10.1 supersedes them.

## Alternatives considered

- **Chosen: bump `darthjee/node` to `0.3.0`.** Fixes the base at the source with a small diff; side effects are a Node patch bump and new base versions that must be published before the release tag.
- Bump to `0.2.2` (smallest multi-arch version): rejected — keeps an older base for no clear gain.
- Pin the base by platform digest / `FROM --platform=$TARGETPLATFORM` on `0.2.1`: not viable — `0.2.1` has no arm64 variant.
- Rebuild `darthjee/node:0.2.1-arm64`: rejected — a fix in another repo that we would then depend on, more work than using an already multi-arch version.
- Replace the `<ver>` / `<ver>-arm64` base tags with a single multi-arch manifest built by `buildx`: rejected for this issue (bigger refactor of `release_kerghan/Dockerfile` and the CI matrix); possible follow-up.
- Build `release_kerghan` straight from `node:0.3.0`, dropping the base layer: rejected — design change, out of scope.

## Edge cases

- **Bootstrap problem in branch/PR CI.** `backend_tests` / `backend_checks` run from the published `darthjee/circleci_kerghan-base:<ver>` (and the standalone Dockerfile pins `darthjee/vite_kerghan-base:<ver>`). `release-image` skips on non-tag builds, so a PR that pins new base versions has no image to pull until the bases are published. On the tag pipeline the order is guaranteed by `requires: release-circleci_kerghan-base` (and `release-production_kerghan-base` for `release-kerghan`).
  - **Decision:** bump everything in one PR (all four base versions and every pin). The user will perform the first publish of the new base images manually when needed — the implementer must stop and ask the user to do it (before the PR's CI is expected to pass) instead of working around it.
- `production_kerghan-base` has no bootstrap problem: `release_kerghan.sh` reads its version from `version` at tag time, and `release-kerghan` requires both base jobs.
- `skip_if_unchanged` (vs. the previous tag) is not a risk: the change touches `dockerfiles/base/`, so all four bases rebuild.
- `jasmine` / `frontend-checks` use `darthjee/circleci_node:0.2.1` directly (amd64-only, CI-only); bumping it is optional and not needed for the fix.
- Old `latest` / `latest-arm64` base tags are overwritten by the tag build: expected and harmless.
- `AGENTS.md` says the backend base family is not published to Docker Hub while `.claude/agents/infra.md` says it is; fix the line if the docs are touched, otherwise leave it.

## Release 0.10.1 steps

`scripts/bump_version.sh 0.10.1` runs **in the same PR** as the fix (decision; #579 used a separate PR for 0.10.0). It updates the README, both `package.json` files, the client CLI and installer pins, and the Render Dockerfile's `FROM darthjee/kerghan:<v>`. It does not touch the base image versions in `version`, so those are bumped by hand as part of the fix.

1. **Single PR (closes #580):**
   - bump `NODE_IMAGE_VERSION` to `0.3.0` in `dockerfiles/base/Dockerfile`;
   - bump all four base versions in `version`;
   - update every pin to the new base versions (CircleCI executors, `dockerfiles/kerghan_standalone/Dockerfile`, docker-compose, docs);
   - run `scripts/bump_version.sh 0.10.1`.
2. **Manual first publish (done by the user; the implementer must stop and ask):** before the PR's CI can pass, the user publishes the four new base images, amd64 and `-arm64`, with `FORCE_IMAGE_BUILD=1 bin/image.sh push <image> [arm64]` (bypasses the tag guard; needs the Docker Hub login, arm64 builds run under QEMU).
3. Merge the PR once CI is green.
4. The user tags `0.10.1` on `main`. The tag pipeline rebuilds the bases, then releases `darthjee/kerghan`, then `darthjee/kerghan-standalone`, then the client assets.

## Acceptance criteria (post-release verification)

- `release-kerghan-standalone` passes, including the per-architecture check in `save_image`.
- The `darthjee/kerghan:0.10.1` arm64 manifest and the `production_kerghan-base` arm64 variant have layers different from the amd64 ones (checked through the registry manifests).
- `darthjee/kerghan-standalone:0.10.1` and `0.10.1-offline` are published for both `linux/amd64` and `linux/arm64`.
