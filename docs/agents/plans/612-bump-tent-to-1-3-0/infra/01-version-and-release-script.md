# Source of truth and release script

Add the single source of truth and make the standalone release script read it, drop the per-architecture Tent helper, and add the multi-arch guard.

- `version`: append `tent=1.3.0`.
- `bin/release_kerghan_standalone.sh`:
  - replace `TENT_IMAGE=darthjee/tent:1.0.3` with `TENT_VERSION=$(grep '^tent=' version | sed -e 's/^tent=//')` and `TENT_IMAGE="darthjee/tent:$TENT_VERSION"` at file scope, next to `MYSQL_IMAGE` / `LOGS_IMAGE`; abort with an explicit message when `TENT_VERSION` is empty, before any pull (the script already runs from the repository root, as `bin/release_kerghan.sh` does when reading `version`);
  - delete `tent_image_for()` (single caller, in `save_images()`);
  - add `require_platform_manifest <arch> <image>` (contract 6), reusing `platform_digest` and its `^sha256:[0-9a-f]{64}$` filter;
  - in `save_images()`, call `require_platform_manifest "$arch" "$TENT_IMAGE"` then `save_image "$arch" "$TENT_IMAGE" tent` for each architecture;
  - update the header comment if it mentions per-architecture Tent tags.
- `scripts/test/release_kerghan_standalone.bats` and fixtures:
  - replace the `darthjee/tent:1.0.3-arm64` test (lines ~57–60) with a neutral multi-arch fixture, e.g. `darthjee/tent:9.9.9`: rename `fixtures/darthjee_tent_1.0.3.json` to `darthjee_tent_9.9.9.json` (an index with amd64 + arm64 entries) and delete `darthjee_tent_1.0.3-arm64.json`; check `stubs/docker` resolves fixtures by `<repo>_<tag>.json` and adjust if needed;
  - add cases: `require_platform_manifest` aborts with the guard message on a single-arch tag (reuse `fixtures/only_amd64_1.0.json` asking for arm64); passes on the multi-arch fixture; `TENT_IMAGE` is derived from a `version` file's `tent=` line; an empty `tent=` aborts before any `docker pull`.

## Files to Change

- `version` — add `tent=1.3.0`.
- `bin/release_kerghan_standalone.sh` — read `TENT_VERSION` from `version`, drop `tent_image_for`, add and call `require_platform_manifest`.
- `scripts/test/release_kerghan_standalone.bats` — neutral fixture, guard and lookup cases.
- `scripts/test/fixtures/darthjee_tent_1.0.3.json` → `darthjee_tent_9.9.9.json`; delete `darthjee_tent_1.0.3-arm64.json`.
- `scripts/test/stubs/docker` / `scripts/test/helpers/release_standalone.bash` — only if fixture resolution needs it.
