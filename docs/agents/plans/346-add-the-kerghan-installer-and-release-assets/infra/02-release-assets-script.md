# Add the release-asset script

Create `bin/release_kerghan_assets.sh`, styled like `bin/release_kerghan_standalone.sh`
(`set -euo pipefail`, small functions, a `release` entry):

1. `require_tag`: fail when `CIRCLE_TAG` is empty. `GITHUB_TOKEN` must be set (clear error
   otherwise).
2. `check_pins`: `KERGHAN_VERSION` in `standalone/bin/kerghan` and in `standalone/install.sh`
   both equal `CIRCLE_TAG`. Otherwise fail, naming the file. This prevents shipping a client
   that runs another image version.
3. `stage`: copy the three files into a temp dir under their asset basenames. Run
   `sha256sum kerghan install.sh config.example > SHA256SUMS` there, then
   `sha256sum -c SHA256SUMS` as a self-check.
4. `ensure_release`: if `gh release view "$CIRCLE_TAG"` fails, run
   `gh release create "$CIRCLE_TAG" --verify-tag --title "$CIRCLE_TAG" --notes "..."`. Tolerate
   an "already exists" race.
5. `upload`: `gh release upload "$CIRCLE_TAG" kerghan install.sh config.example SHA256SUMS
   --clobber`, so a re-run replaces the assets.

`gh` targets the repo through `--repo darthjee/kerghan` (explicit, not inferred from the
checkout).

## Files to Change

- `bin/release_kerghan_assets.sh` — new (mode 755).
