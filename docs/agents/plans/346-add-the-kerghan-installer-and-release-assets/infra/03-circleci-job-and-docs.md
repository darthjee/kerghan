# Add the CircleCI job and document it

- `.circleci/config.yml`:
  - new job `release-kerghan-assets`: a small executor (e.g. `cimg/base:stable`), `checkout`. It
    installs a pinned `gh` release (download `gh_<ver>_linux_amd64.tar.gz` from
    `github.com/cli/cli/releases`, extract, put on PATH; no apt repo setup needed). Then it runs
    `bin/release_kerghan_assets.sh release`. Add a comment block like the neighboring jobs.
  - workflow entry: `release-kerghan-assets` with `requires: [release-kerghan-standalone]` and
    `filters: *tags_only`.
- `docs/agents/environment-variables.md` §4 (CircleCI project variables): add `GITHUB_TOKEN`
  (purpose: create the GitHub release and upload the client/installer assets; needs
  `contents: write` on `darthjee/kerghan`; used by `bin/release_kerghan_assets.sh`).
- `docs/agents/specs/standalone/images.md` "When and in which order": add step
  `release-kerghan-assets` after `release-kerghan-standalone`.

## Files to Change

- `.circleci/config.yml` — new job and workflow entry.
- `docs/agents/environment-variables.md` — `GITHUB_TOKEN` row.
- `docs/agents/specs/standalone/images.md` — CI order.
