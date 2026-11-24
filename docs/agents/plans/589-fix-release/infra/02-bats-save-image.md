# Bats coverage for save_image

Add a bats suite for `save_image` to the existing `scripts/test/` suite. The `scripts_tests` CI job (`bats scripts/test`, repo checkout) and the local `scripts_tests` compose service already run it.

## Harness

- New `scripts/test/stubs/docker`, in the style of the existing `curl`/`git` stubs:
  - appends each call to `$STUB_LOG` as `docker <args>`;
  - `buildx imagetools inspect <image> --format {{json .Manifest}}` prints a canned JSON fixture, chosen per image. For example, read `$STUB_MANIFESTS_DIR/<image with / and : replaced>.json`, and fail (exit 1) if the fixture is missing.
  - `image inspect -f {{.Architecture}} <image>` prints `$STUB_ARCH` (default: the arch of the last pulled digest, or a fixed value set per test);
  - `pull`, `tag`, `save` succeed (`save` may touch the `-o` path so the test can assert it).
- New helper `scripts/test/helpers/release_standalone.bash` (or an extension of `setup.bash` that leaves the deploy tests untouched):
  - sets up the temp dir and puts the `docker` stub first on `PATH`;
  - sources `bin/release_kerghan_standalone.sh` (resolved as `$BATS_TEST_DIRNAME/../../bin/...`; see Local runner below);
  - points `IMAGES_DIR` at a temp dir.
- Fixtures: small JSON files mirroring the real shapes listed in [../infra.md](../infra.md#context) (index with amd64 + arm64; mysql-like index with `arm64` variant `v8` and `unknown/unknown` attestations; single-platform manifest with a `digest` and no `manifests`).

## Cases (`scripts/test/release_kerghan_standalone.bats`)

1. Multi-platform index, `arm64`: logs `docker pull darthjee/kerghan@<arm64 digest>`, `docker tag darthjee/kerghan@<arm64 digest> darthjee/kerghan:1.2.3`, `docker save darthjee/kerghan:1.2.3 -o <IMAGES_DIR>/arm64/kerghan.tar`.
2. Multi-platform index, `amd64`: picks the amd64 digest.
3. MySQL-like index (`arm64` variant `v8` plus attestations): picks the arm64 digest, never an attestation digest.
4. Single-platform manifest (Tent shape): pulls `<repo>@<its own digest>` and tags `darthjee/tent:1.0.3-arm64`.
5. No `linux/<arch>` entry: exits 1 with `has no linux/arm64 manifest`; no `docker pull` or `docker save` logged.
6. Two matching entries: exits 1 with the "several manifests" error; no `docker pull` logged.
7. `image inspect` reports another architecture: exits 1 with `is amd64, expected arm64.`; no `docker save` logged.
8. Sourcing the script runs nothing (no stub calls logged), and executing it with an unknown action still prints the usage and exits 1.

## Local runner

`docker-compose.yml`'s `scripts_tests` service only mounts `./scripts:/scripts:ro`, so `bin/` is not visible locally. Do not mount `./bin` at `/bin`, which would shadow the container's system `/bin`. Instead, mount the repo read-only at a neutral path (e.g. `.:/repo:ro`), set `working_dir: /repo`, and run `bats scripts/test`. Relative `$BATS_TEST_DIRNAME/../../bin` paths then resolve the same way locally and in CI. Check that the existing deploy tests still pass with the new mount.

## Files to Change

- `scripts/test/stubs/docker`: new docker stub.
- `scripts/test/helpers/release_standalone.bash` (or `setup.bash` extended without changing deploy behaviour): harness that sources the release script.
- `scripts/test/fixtures/` (or similar): manifest JSON fixtures.
- `scripts/test/release_kerghan_standalone.bats`: the cases above.
- `docker-compose.yml`: `scripts_tests` service mounts the repo so `bin/` is reachable.
- `.circleci/config.yml`: only update the `scripts_tests` comment ("Render deploy scripts") to also mention the standalone release script; the job command is unchanged.
