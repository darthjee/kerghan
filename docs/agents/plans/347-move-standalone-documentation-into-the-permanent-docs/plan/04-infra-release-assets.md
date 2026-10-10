# Document the release assets in infra.md

`docs/agents/architecture/infra.md` covers `release-kerghan` and `release-kerghan-standalone` but
not the client/installer assets. Read `.circleci/config.yml` (`release-kerghan-assets`) and
`bin/release_kerghan_assets.sh`, then add:

- A row for `release-kerghan-assets` in the jobs table: executor, tag only, requires
  `release-kerghan-standalone`, purpose.
- A "### `release-kerghan-assets` — client assets on the GitHub release" section after the
  `release-kerghan-standalone` section. It covers how `gh` is installed (pinned,
  checksum-verified tarball, per the job comment) and authenticated with `GITHUB_TOKEN`;
  creating the release when it is missing; the four assets (`kerghan` with its pinned image
  version, `install.sh`, `config.example`, `SHA256SUMS`); `--clobber` reruns; and how users
  verify the checksums (link to `../standalone.md`).
- A row for `bin/release_kerghan_assets.sh` in the "Scripts" table.
- `release-kerghan-assets` in the release-chain diagram, after `release-kerghan-standalone`.

Do not touch the Render deploy text or the `build-and-release` dependency note: #341 owns them.
Link to `../standalone.md` for what the images contain instead of repeating it.

## Files to Change

- `docs/agents/architecture/infra.md` — `release-kerghan-assets` job row, section, script row,
  diagram
