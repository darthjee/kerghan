# Infra Plan: Standalone: write the inner services' logs to a host directory

Main plan: [plan.md](plan.md)

## Shared contracts

- **Image:** the collector image is `docker:<X.Y.Z>-cli`. The exact string is whatever the
  `standalone` agent writes as `LOGS_IMAGE=` in `dockerfiles/kerghan_standalone/Dockerfile`, and it
  must match byte for byte.
- **Tarball:** the offline tarball is `standalone/images/<arch>/docker-cli.tar`, for both `amd64`
  and `arm64`.

## Implementation Steps

### Step 1 — Preload the collector image in the offline release

In `bin/release_kerghan_standalone.sh`:
- Add `LOGS_IMAGE="docker:<X.Y.Z>-cli"` next to `MYSQL_IMAGE`, `MYSQL_LEGACY_IMAGE` and
  `TENT_IMAGE` (around :18-20), with a comment saying it must match `LOGS_IMAGE` in the standalone
  Dockerfile's `.env` step.
- In `save_images` (:108-123), add `save_image "$arch" "$LOGS_IMAGE" docker-cli` for each arch.
  `save_image` already pulls the `linux/<arch>` digest from a manifest index (:55-102), and the
  official image is a multi-arch index, so no per-arch tag mapping (like `tent_image_for`) is
  needed.
- Update the header comment that lists the tarballs (around :10 and :69).

In `scripts/test/release_kerghan_standalone.bats`, add a `save_image` case for the Docker CLI image
with a manifest-index fixture under `scripts/test/fixtures/` (modelled on `mysql_8.4.11.json`). It
should show that each arch's digest is selected and the tarball is named `docker-cli.tar`.

### Step 2 — Docs

- `docs/agents/architecture/infra/releases.md:70-77`: add `docker-cli.tar` (`docker:<X.Y.Z>-cli`)
  to the list of preloaded images and note that it must match the Dockerfile's `LOGS_IMAGE`.

## Files to Change

- `bin/release_kerghan_standalone.sh`: `LOGS_IMAGE` constant, `save_images`, header comments.
- `scripts/test/release_kerghan_standalone.bats`: a `save_image` case for the CLI image.
- `scripts/test/fixtures/docker_<X.Y.Z>-cli.json` (new): the manifest-index fixture.
- `docs/agents/architecture/infra/releases.md`: the preloaded images list.

## CI Checks

- `scripts/`: `docker-compose run --rm scripts_tests` (CI job: `scripts_tests`)

## Notes

- The release smoke test (`release-kerghan-standalone` tag job) runs the offline image with
  `--pull never`. If the tarball is missing, the inner stack fails to start the `logs` service and
  `check_offline` fails, which is the intended guard.
- The offline image grows by the size of the CLI image (about 60–70 MB per arch). That is
  expected and accepted in the issue.
