# Architecture — Infra

CircleCI (`.circleci/config.yml`) is Kerghan's only CI/CD pipeline: it runs tests/lint on every
push and, on semver tag pushes only, builds/publishes images and triggers the production
release. This page documents that pipeline's job graph — the "infra" counterpart to
`architecture/proxy.md`/`frontend.md`/`backend.md`. Modeled on Majora's
`.claude/agents/infra.md` "CircleCI pipeline" section, adapted to Kerghan's simpler
Render-based deploy (no `link_photos`/`link_files`/`upload_admin_assets`/`wake-navi`
equivalents — Kerghan doesn't warm the Navi cache from CI yet, see `docs/agents/cache-warmer.md`).

## Workflow

All test/lint jobs run on every push. The release chain (`build-and-release`, the `upload_*`
jobs, and `release`) is gated to **semver tag pushes only**, via the shared `tags_only` filter
(`tags: { only: /\d+\.\d+\.\d+/ }`, `branches: { ignore: /.*/ }`). The `release-image` jobs
(the 4 base-image publishes) have no branch filter at all — CircleCI schedules them on every
push, but `bin/image.sh`'s `skip_if_not_tag` guard makes them a fast no-op unless the push is a
tag, and `skip_if_unchanged` makes even tag builds a no-op when the relevant `dockerfiles/`
directory hasn't changed since the last release.

```
release-circleci_kerghan-base(-arm64) ─┬─ backend_tests ──┐
                                        └─ backend_checks ─┤
                                          jasmine ─────────┼─ build-and-release ─────────────────┐
                                    frontend-checks ───────┤                                      │
                              proxy_extension_tests ───────┤                                      │
                                                            │                                      │
        release-production_kerghan-base(-arm64) ───────────┘                                      │
                                                            ├─ upload_proxy_files ─┬─ upload_extension ──────┐
                                                            │                      └─ copy_proxy_configuration┤
                                                            └─ upload_fe_files ─────────────────────────────┼─ release
                              release-vite_kerghan-base(-arm64) ───────────────────────────────────────────┘

backend_tests ─┬─ coverage-final   (side branch off the same jobs, not part of the release chain)
jasmine ───────┘

release-kerghan-base(-arm64)  — published for local/dev use; nothing in this workflow requires it
```

The five boxes feeding `build-and-release`/`upload_proxy_files`/`upload_fe_files`
(`backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, `proxy_extension_tests`) are
each required directly by all three of those jobs — the diagram only draws the edges once to
stay readable. `coverage-final` requires only `backend_tests` and `jasmine` (the two jobs that
upload partial Codacy coverage) and isn't required by anything else — it doesn't gate the release
chain, it just finalizes the aggregated Codacy report once both partial uploads have completed.

### Why `build-and-release` requires the production-base release-image jobs

`build-and-release` requires `release-production_kerghan-base` and
`release-production_kerghan-base-arm64` (fixed by issue #17) even though its own steps
(`scripts/deploy.sh update_deploy_branch` / `deploy`) never reference the image directly. The
dependency exists purely to sequence the Docker Hub push ahead of the Render deploy trigger:
`dockerfiles/production_kerghan/Dockerfile` is `FROM darthjee/production_kerghan-base:latest`,
so Render's build must never fire before the freshly built `production_kerghan-base:latest` has
finished pushing — otherwise it could pull a stale image left over from a previous release. Same
pattern already existed for `upload_fe_files`, which requires `release-vite_kerghan-base(-arm64)`
for the equivalent reason on the frontend side.

`release` (the final atomic-swap job) does not need its own direct dependency on the
production-base jobs — it already requires `build-and-release`, and CircleCI only starts a job
once everything in its `requires` list has finished successfully, so the ordering guarantee
holds transitively.

`release-kerghan-base(-arm64)` and `release-circleci_kerghan-base(-arm64)` don't need a direct
`build-and-release`/`release` dependency either: `release-circleci_kerghan-base(-arm64)` is
already required by `backend_tests`/`backend_checks`, both of which run before
`build-and-release`/`release` in the graph, so they're safely ordered transitively too.
`release-kerghan-base(-arm64)` (the dev-only base image) isn't required by anything in this
workflow at all — nothing downstream depends on it being fresh.

## CI jobs

| Job | Image/Executor | Filter | Purpose |
|-----|-----------------|--------|---------|
| `backend_tests` | `darthjee/circleci_kerghan-base:0.1.0` | every push | Backend test suite + coverage; uploads a partial Codacy coverage report afterward |
| `backend_checks` | `darthjee/circleci_kerghan-base:0.1.0` | every push | Backend ESLint |
| `jasmine` | `darthjee/circleci_node:0.2.1` | every push | Frontend test suite + coverage; uploads a partial Codacy coverage report afterward |
| `frontend-checks` | `darthjee/circleci_node:0.2.1` | every push | Frontend ESLint |
| `proxy_extension_tests` | `darthjee/tent-test:0.10.4` | every push | PHPUnit tests for `proxy/extension/` |
| `coverage-final` | `darthjee/circleci_kerghan-base:0.1.0` | every push | Finalizes the aggregated Codacy coverage report once `backend_tests`/`jasmine`'s partial uploads land |
| `release-image` | machine (multi-arch: amd64 + arm64) | every push (no-op unless tag) | Publishes one of the 4 base images to Docker Hub via `bin/image.sh`; instantiated 8 times (one per image × arch) — see below |
| `build-and-release` | machine | tag only | Triggers the Render deploy of the backend (`scripts/deploy.sh`), blocks until it reports "live" |
| `upload_proxy_files` | `darthjee/tent:0.10.4` | tag only | Uploads Tent proxy runtime to the SSH deploy host's staging dir |
| `upload_fe_files` | `darthjee/vite_kerghan-base:0.1.0` | tag only | Builds the Vite frontend, uploads the static output to the staging dir |
| `upload_extension` | `darthjee/tent:0.10.4` | tag only | Uploads the proxy PHP extension (test files stripped) |
| `copy_proxy_configuration` | `darthjee/tent:0.10.4` | tag only | Uploads prod proxy config + restores host-only state (`locals.php`, `.htaccess`) |
| `release` | `darthjee/vite_kerghan-base:0.1.0` | tag only | Atomic swap: only runs once every upload/build job above has succeeded |

### `release-image` instances

`release-image` is a parameterized job (`image`, `arch`), instantiated once per base image ×
architecture:

| Instance name | `image` param | Publishes |
|---------------|----------------|-----------|
| `release-kerghan-base(-arm64)` | `kerghan-base` | Dev backend base image |
| `release-circleci_kerghan-base(-arm64)` | `circleci_kerghan-base` | CI backend base image (used by `backend_tests`/`backend_checks`) |
| `release-production_kerghan-base(-arm64)` | `production_kerghan-base` | Production backend base image (`production_kerghan` is `FROM` this, by `:latest`) |
| `release-vite_kerghan-base(-arm64)` | `vite_kerghan-base` | Frontend/proxy build base image |

The backend image family (`kerghan-base`, `circleci_kerghan-base`, `production_kerghan-base`)
is built in CI but **not actually published to Docker Hub** — only the frontend/proxy
(`vite_kerghan*`) images are. `bin/image.sh` still runs the `release-image` job for all of them
so the ordering/`requires` machinery stays uniform; see `docs/agents/environment-variables.md`
for which Docker Hub credentials are actually wired up.

## CI setup pattern (backend/frontend jobs)

`backend_tests`/`backend_checks` and `jasmine`/`frontend-checks` copy their respective
subdirectory to the workspace root before running commands, since the CI base images expect
files there:

```yaml
# backend
- run: rm frontend -rf; cp backend/* ./ -r; rm backend -rf

# frontend
- run: rm backend -rf; cp frontend/* ./ -r; rm frontend -rf
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/deploy.sh` | Trigger and monitor a Render.com deployment (`update_deploy_branch`, `deploy`) |
| `scripts/render.sh` | Render.com API helpers (sourced by `deploy.sh`) |
| `scripts/bump_version.sh` | Bump the version string across the repo |
| `scripts/wake_navi.sh` / `scripts/warm_navi_cache.sh` | Navi cache-warmer scripts — not yet wired into CircleCI, see `docs/agents/cache-warmer.md` |
| `bin/image.sh` | Builds/pushes a `release-image` instance; `skip_if_not_tag`/`skip_if_unchanged` guards, `qemu`/`push` subcommands |
| `bin/deploy_frontend.sh` | SSH-based upload/release helpers used by `upload_proxy_files`, `upload_fe_files`, `upload_extension`, `copy_proxy_configuration`, `release` |

## No Navi warm-up job yet

Unlike Majora (`warm-up-cache`/`wake-navi`), Kerghan's `.circleci/config.yml` has no job that
pings or warms the Navi cache server after a release — see `docs/agents/cache-warmer.md` for the
current state and `docs/agents/issues/` for tracked work wiring it in.
