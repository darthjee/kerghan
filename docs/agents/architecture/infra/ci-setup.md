# Infra — CI setup, scripts and migrations

How CI jobs are set up, validated and how production boots. Part of the [infra architecture hub](../infra.md).

## CI setup pattern (backend/frontend jobs)

`backend_tests`, `backend_checks`, `jasmine` and `frontend-checks` are four workflow entries of one
`yarn_project` job (parameters: `dir` — `backend` | `frontend`, `image`, `script`, `step_name`,
`upload_coverage`), each setting `name:` to the job name shown above. The job runs `checkout`,
the shared `setup_project` command, `npm run <script>`, and — when `upload_coverage` is true — the
best-effort Codacy upload.

`setup_project` (a top-level CircleCI `commands:` entry, also used by `backend_db_tests` with
`dir: backend` and by `upload_fe_files` with `dir: frontend`) takes `dir` and a required `image`
parameter (each caller passes the same string as its primary `docker` image). It copies the chosen
subdirectory to the workspace root and drops the other one, since the CI base images expect files
there, then restores `node_modules` from the CircleCI cache, runs `yarn install --frozen-lockfile`
and saves the cache. The cache key is `yarn-<dir>-<image>-<checksum of yarn.lock>`, a single key with
no prefix fallback, so a changed lockfile always starts from an empty `node_modules`. `yarn install`
always runs (a fast integrity check on a hit). Because of `--frozen-lockfile`, a `yarn.lock` that is
out of sync with `package.json` now fails CI.

```yaml
# dir: backend
rm frontend -rf; cp backend/* ./ -r; rm backend -rf

# dir: frontend
rm backend -rf; cp frontend/* ./ -r; rm frontend -rf
```

## Validating the CircleCI config locally

The `circleci` compose service (pinned `circleci/circleci-cli` image, `.circleci/` mounted
read-only) runs the CircleCI CLI without installing anything on the host:

```bash
docker-compose run --rm circleci config validate
docker-compose run --rm circleci config process .circleci/config.yml   # expanded jobs/workflows
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/deploy.sh` | Deploy a release tag to Render.com and wait for `live`: `deploy` (CI, uses `CIRCLE_TAG`), `force_deploy <tag>` (skips the latest-tag check); both check the thin Dockerfile's `FROM` tag, move the service branch to the tag and trigger a deploy. Also `watch`, `service_id` |
| `scripts/render.sh` | Render.com API helpers (sourced by `deploy.sh`) |
| `scripts/test/` | bats suite for `deploy.sh`/`render.sh` (stubbed `curl`), `bump_tent.sh` and `bin/release_kerghan_standalone.sh`, run by `scripts_tests` |
| `scripts/bump_version.sh` | Bump the version string across the repo |
| `scripts/bump_vault.sh` | Bump the Vault version pinned across the standalone distribution |
| `scripts/bump_tent.sh` | Bump the Tent pin (`<X.Y.Z>`) or verify its copies (`--check`) — see [Tent pin](#tent-pin) |
| `scripts/wake_navi.sh` / `scripts/warm_navi_cache.sh` | Navi cache-warmer scripts — not yet wired into CircleCI, see `docs/agents/cache-warmer.md` |
| `bin/release_kerghan.sh` | Multi-arch buildx release of `darthjee/kerghan` (`release` subcommand), used by `release-kerghan` |
| `bin/release_kerghan_standalone.sh` | Multi-arch release of `darthjee/kerghan-standalone` online and offline (`release` subcommand): saves per-arch inner tarballs, pushes `<tag>`/`<tag>-offline`, smoke-tests, then promotes `latest`/`latest-offline`. Used by `release-kerghan-standalone` |
| `bin/release_kerghan_assets.sh` | Publishes the `kerghan` client, `install.sh`, `config.example` and `SHA256SUMS` to the GitHub release of the tag (`release` subcommand), after checking the client and installer pin the tag. Used by `release-kerghan-assets` |
| `bin/image.sh` | Builds/pushes a `release-image` instance; `skip_if_not_tag`/`skip_if_unchanged` guards, `qemu`/`push` subcommands |
| `bin/deploy_frontend.sh` | SSH-based upload/release helpers used by `upload_proxy_files`, `upload_fe_files`, `upload_extension`, `copy_proxy_configuration`, `release` |

## Tent pin

The `tent=<X.Y.Z>` line of the root `version` file is the single source of truth for both
`darthjee/tent` and `darthjee/tent-test`, which always move together.
`bin/release_kerghan_standalone.sh`, `dockerfiles/kerghan_standalone/Dockerfile` and
`.claude/scripts/check_proxy.sh` read it directly. The other files hold copies:

```bash
scripts/bump_tent.sh <X.Y.Z>   # writes tent=<X.Y.Z> to `version`, then rewrites every copy
scripts/bump_tent.sh --check   # rewrites nothing; fails listing each copy that differs
```

- The copies are `docker-compose.yml`, `.circleci/config.yml`,
  `docs/agents/architecture/infra/ci-jobs.md`, `.claude/agents/proxy.md` and
  `.claude/agents/infra.md`. The list is explicit in the script: add a file there when it starts to
  carry a Tent version.
- A copy is `darthjee/tent:X.Y.Z` or `darthjee/tent-test:X.Y.Z` followed by end of line,
  whitespace or a backtick. `latest` and suffixed tags are left alone.
- The `scripts_tests` CircleCI job runs `--check` on every push, so a hand-edited copy fails CI.
  Locally, `scripts_tests` has no `git`, so pass the repository root:
  `docker-compose run --rm -e ROOT=/repo --entrypoint scripts/bump_tent.sh scripts_tests --check`.
- `docs/agents/architecture/security.md` is **not** rewritten by the script. It names the Tent
  version Kerghan's security assumptions were verified against: after every bump, recheck those
  assumptions and then update it by hand.
- The CircleCI pins decide the production Tent runtime (see
  [releases.md](releases.md#tent-version)).

## Migrations on production boot

`dockerfiles/release_kerghan/Dockerfile` sets `dockerfiles/release_kerghan/entrypoint.sh`
as its `ENTRYPOINT` (inherited by the thin Render Dockerfile). On container start, the entrypoint runs `yarn migration:run` first and,
because it's a `set -e` `/bin/sh` script, any migration failure aborts immediately with a
non-zero exit — `node dist/main.js` (invoked via `exec`, so it replaces the shell as PID 1) never
runs against a broken/partial schema. This applies only to the production image; the dev/test
containers (`kerghan_app`, `kerghan_tests`) and `make setup` are unchanged and still run
migrations manually.

This issue does not add automated migration-revert tooling. If a deploy that included a new
migration is rolled back, the newer migration's schema changes remain in the database — reverting
them requires manually running `yarn migration:revert` (e.g. via a one-off shell against the
running container, or a local connection using the deploy's `KERGHAN_MYSQL_*` values).

## No Navi warm-up job yet

Unlike Majora (`warm-up-cache`/`wake-navi`), Kerghan's `.circleci/config.yml` has no job that
pings or warms the Navi cache server after a release — see `docs/agents/cache-warmer.md` for the
current state and `docs/agents/issues/` for tracked work wiring it in.
