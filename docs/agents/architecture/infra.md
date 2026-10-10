# Architecture — Infra

CircleCI (`.circleci/config.yml`) is Kerghan's only CI/CD pipeline: it runs tests/lint on every
push and, on semver tag pushes only, builds/publishes images and triggers the production
release. This page documents that pipeline's job graph — the "infra" counterpart to
`architecture/proxy.md`/`frontend.md`/`backend.md`. Modeled on Majora's
`.claude/agents/infra.md` "CircleCI pipeline" section, adapted to Kerghan's simpler
Render-based deploy (no `link_photos`/`link_files`/`upload_admin_assets`/`wake-navi`
equivalents — Kerghan doesn't warm the Navi cache from CI yet, see `docs/agents/cache-warmer.md`).

## Workflow

All test/lint jobs run on every push. The release chain (`build-and-release`, `release-kerghan`,
`release-kerghan-standalone`, the `upload_*` jobs, and `release`) is gated to **semver tag pushes only**, via the shared `tags_only` filter
(`tags: { only: /\d+\.\d+\.\d+/ }`, `branches: { ignore: /.*/ }`). The `release-image` jobs
(the 4 base-image publishes) have no branch filter at all — CircleCI schedules them on every
push, but `bin/image.sh`'s `skip_if_not_tag` guard makes them a fast no-op unless the push is a
tag, and `skip_if_unchanged` makes even tag builds a no-op when neither `dockerfiles/base/` nor
`bin/image.sh` has changed since the last release (see "Shared base Dockerfile" below).

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

backend_tests, backend_checks, jasmine, frontend-checks, proxy_extension_tests ─┐
                              release-production_kerghan-base(-arm64) ──────────┴─ release-kerghan ─ release-kerghan-standalone
                                  (build-and-release does not require release-kerghan yet — #341 will)
```

The five boxes feeding `build-and-release`/`upload_proxy_files`/`upload_fe_files`
(`backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, `proxy_extension_tests`) are
each required directly by all three of those jobs — the diagram only draws the edges once to
stay readable. `coverage-final` requires only `backend_tests` and `jasmine` (the two jobs that
upload partial Codacy coverage) and isn't required by anything else — it doesn't gate the release
chain, it just finalizes the aggregated Codacy report once both partial uploads have completed.

All three Codacy upload steps (the partial uploads in `backend_tests`/`jasmine`, and the
finalize step in `coverage-final`) are best-effort/non-blocking (`|| true` on the upload
command): `CODACY_PROJECT_TOKEN` isn't provisioned in CircleCI's project settings yet, so as
things stand today the uploader always fails with "Invalid configuration: Either a project or
account API token must be provided". Making the step non-blocking keeps that missing credential
from failing `backend_tests`/`jasmine` themselves — which would otherwise incorrectly gate
`build-and-release` on an unrelated external-service token — while still actually attempting the
upload every run, so real Codacy reporting resumes automatically, with no further config change,
once the token is provisioned. The test/lint commands earlier in each job remain the real
pass/fail gate.

### `.codacy.yml` — suppressing confirmed static-analysis false positives

Separate from the CircleCI coverage upload above, Codacy's GitHub App also runs its own static
analysis directly against every PR (the "Codacy Static Code Analysis" check-run), gating on zero
new issues of at least minor severity. `.codacy.yml` (repo root) is Codacy's own supported,
version-controlled configuration file for narrowly excluding specific tool/path combinations from
that analysis — introduced in PR #33 (issue #30) to resolve a real block: PMD's ecmascript module
misparses this codebase's private class methods/fields (`static async #method() {}`) as a
redundant "Unnecessary block", flagging the method body itself. Confirmed as a PMD parser
limitation with this JS syntax, not a real code smell, this is scoped to only the three files that
use private methods heavily (`ApiClient.js`, `AccountsClient.js`, `HeaderController.js`) via
`engines.pmd.exclude_paths`, rather than disabling PMD (or any rule) repository-wide. Other
confirmed false positives from that same PR (Codacy's `xss/no-mixed-html` firing on
`renderToStaticMarkup`-based Jasmine spec assertions, and `security/detect-object-injection`
firing on bracket-notation access with a compile-time-fixed key) were resolved with narrower,
per-line `// eslint-disable-next-line <rule>` comments instead, since Codacy's ESLint-based tool
respects native ESLint inline-disable syntax — `.codacy.yml` was reserved for PMD, which has no
such per-line mechanism available here. Future Codacy findings should default to the same
per-line-inline-disable approach when the underlying tool supports it, falling back to a
narrowly-scoped `.codacy.yml` `exclude_paths` entry (documented inline, same as above) only when
it doesn't.

### Why `build-and-release` requires the production-base release-image jobs

`build-and-release` requires `release-production_kerghan-base` and
`release-production_kerghan-base-arm64` (fixed by issue #17) even though its own steps
(`scripts/deploy.sh update_deploy_branch` / `deploy`) never reference the image directly. The
dependency exists purely to sequence the Docker Hub push ahead of the Render deploy trigger:
`dockerfiles/production_kerghan/Dockerfile` is `FROM darthjee/production_kerghan-base:${BASE_VERSION}`
(`-arm64` suffixed on arm64, see "Production Dockerfile base selection" below), and Render does not
pass `BASE_VERSION`, so it builds from `:latest`. Render's build must never fire before the freshly built `production_kerghan-base:latest` has
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
| `backend_tests` | `darthjee/circleci_kerghan-base:0.1.0` | every push | `yarn_project` instance (`dir: backend`, `script: coverage`, `upload_coverage: true`): backend test suite + coverage; uploads a partial Codacy coverage report afterward (best-effort, non-blocking) |
| `backend_checks` | `darthjee/circleci_kerghan-base:0.1.0` | every push | `yarn_project` instance (`dir: backend`, `script: lint`): backend ESLint |
| `jasmine` | `darthjee/circleci_node:0.2.1` | every push | `yarn_project` instance (`dir: frontend`, `script: coverage`, `upload_coverage: true`): frontend test suite + coverage; uploads a partial Codacy coverage report afterward (best-effort, non-blocking) |
| `frontend-checks` | `darthjee/circleci_node:0.2.1` | every push | `yarn_project` instance (`dir: frontend`, `script: lint`): frontend ESLint |
| `proxy_extension_tests` | `darthjee/tent-test:1.0.3` | every push | PHPUnit tests for `proxy/extension/` |
| `coverage-final` | `darthjee/circleci_kerghan-base:0.1.0` | every push | Finalizes the aggregated Codacy coverage report once `backend_tests`/`jasmine`'s partial uploads land (best-effort, non-blocking) |
| `release-image` | machine (multi-arch: amd64 + arm64) | every push (no-op unless tag) | Publishes one of the 4 base images to Docker Hub via `bin/image.sh`; instantiated through a single workflow `matrix` (4 images × 2 archs = 8 jobs) — see below |
| `release-kerghan` | machine (`ubuntu-2204:current`, multi-arch: amd64 + arm64) | tag only | Builds and pushes `darthjee/kerghan:<tag>` and `:latest` as one multi-arch manifest via `bin/release_kerghan.sh release` (buildx, `docker-container` builder) — see below |
| `release-kerghan-standalone` | machine (`ubuntu-2204:current`, multi-arch: amd64 + arm64) | tag only | Requires `release-kerghan`. Publishes `darthjee/kerghan-standalone` online and offline via `bin/release_kerghan_standalone.sh release`; smoke-tests the offline image before moving `latest`/`latest-offline` — see below |
| `build-and-release` | machine | tag only | Triggers the Render deploy of the backend (`scripts/deploy.sh`), blocks until it reports "live" |
| `upload_proxy_files` | `darthjee/tent:1.0.3` | tag only | Uploads Tent proxy runtime to the SSH deploy host's staging dir |
| `upload_fe_files` | `darthjee/vite_kerghan-base:0.1.0` | tag only | Builds the Vite frontend, uploads the static output to the staging dir |
| `upload_extension` | `darthjee/tent:1.0.3` | tag only | Uploads the proxy PHP extension (test files stripped) |
| `copy_proxy_configuration` | `darthjee/tent:1.0.3` | tag only | Uploads prod proxy config + restores host-only state (`locals.php`, `.htaccess`) |
| `release` | `darthjee/vite_kerghan-base:0.1.0` | tag only | Atomic swap: only runs once every upload/build job above has succeeded |

### `release-image` instances

`release-image` is a parameterized job (`image`, `suffix`), instantiated by one `matrix` entry in
the `test` workflow (`image` × `suffix`, with `suffix` either `""` for amd64 or `"-arm64"`). The
entry's `name:` is the template `release-<< matrix.image >><< matrix.suffix >>`, which yields the
eight job names below (the names are referenced by `requires:` and must stay stable). The release
step strips the leading `-` from `suffix` before calling `bin/image.sh push <image> [arch]`, so
`bin/image.sh` still receives an empty arch (amd64) or `arm64`:

| Instance name | `image` param | Publishes |
|---------------|----------------|-----------|
| `release-kerghan-base(-arm64)` | `kerghan-base` | Dev backend base image |
| `release-circleci_kerghan-base(-arm64)` | `circleci_kerghan-base` | CI backend base image (used by `backend_tests`/`backend_checks`) |
| `release-production_kerghan-base(-arm64)` | `production_kerghan-base` | Production backend base image (the `darthjee/kerghan` production image, built from `dockerfiles/production_kerghan/`, is `FROM` this — `:latest` by default, pinned to the `version` file only in `release-kerghan`; the per-arch tag is picked from `TARGETARCH`) |
| `release-vite_kerghan-base(-arm64)` | `vite_kerghan-base` | Frontend/proxy build base image |

The backend image family (`kerghan-base`, `circleci_kerghan-base`, `production_kerghan-base`)
is built in CI but **not actually published to Docker Hub** — only the frontend/proxy
(`vite_kerghan*`) images are. `bin/image.sh` still runs the `release-image` job for all of them
so the ordering/`requires` machinery stays uniform; see `docs/agents/environment-variables.md`
for which Docker Hub credentials are actually wired up.

### Leaf image tags and the one-time stale-image cleanup

The leaf images keep their `dockerfiles/` folder names but are tagged differently (#339):
`dockerfiles/kerghan/` builds the local dev image `darthjee/dev_kerghan` (compose `base` /
`base_build`, `make build`), and `dockerfiles/production_kerghan/` builds the production image
`darthjee/kerghan` (compose `base_prod` / `base_prod_build`; Render builds the same Dockerfile by
path). `darthjee/kerghan` is published to Docker Hub by `release-kerghan` (see below);
`darthjee/dev_kerghan` is never pushed.

Before #339 the dev image was tagged `darthjee/kerghan`. A developer who still has that old local
tag would have `base_prod` run the stale dev image under the production tag, so remove it and
rebuild once:

```bash
docker image rm darthjee/kerghan
docker-compose build base_prod_build   # rebuilds darthjee/kerghan (production)
docker-compose build base_build        # rebuilds darthjee/dev_kerghan (dev)
```

### `release-kerghan` — the production image on Docker Hub

`release-kerghan` (#340) runs `bin/release_kerghan.sh release` on semver tags. The script fails if
`CIRCLE_TAG` is empty, reads `production_kerghan-base=<ver>` from the `version` file, sets up QEMU
and a `docker-container` buildx builder (the default `docker` driver cannot push multi-platform
images), logs in with `DOCKER_HUB_USERNAME`/`DOCKER_HUB_PASSWORD`, and runs one
`docker buildx build --platform linux/amd64,linux/arm64 --build-arg BASE_VERSION=<ver> --push`
tagged `$DOCKER_ID_USER/kerghan:<CIRCLE_TAG>` and `:latest`. It then prints
`docker buildx imagetools inspect` so the log shows both platforms. There is no skip-if-unchanged
guard: every release tag publishes the image.

Unlike the `*-base` images, `darthjee/kerghan` is a **multi-arch manifest**: one tag serves both
amd64 and arm64, with no `-arm64` suffix. It is versioned by the **git tag**, not by the `version`
file (the `version` file only pins its base image).

It requires the five test/lint jobs and `release-production_kerghan-base(-arm64)`, so the pinned
base tags exist before the build. `release-kerghan-standalone` (#343) requires it, because the
standalone image bundles `darthjee/kerghan:<tag>`. #341 will also make `build-and-release` depend
on it.

### `release-kerghan-standalone` — the standalone image on Docker Hub

`release-kerghan-standalone` (#343) runs `bin/release_kerghan_standalone.sh release` on semver
tags, after `release-kerghan`. It uses the same Docker Hub env vars (`DOCKER_ID_USER`,
`DOCKER_HUB_USERNAME`, `DOCKER_HUB_PASSWORD`) and the same QEMU + `docker-container` buildx setup.
It publishes four tags of `$DOCKER_ID_USER/kerghan-standalone`, all multi-arch manifests
(amd64 + arm64):

| Tag | Dockerfile target | Contents |
|-----|-------------------|----------|
| `<tag>` | `standalone` | Online: pulls the inner images on first boot |
| `<tag>-offline` | `standalone-offline` | Offline: inner images preloaded from tarballs |
| `latest` | — | Points at `<tag>` |
| `latest-offline` | — | Points at `<tag>-offline` |

Both targets come from `dockerfiles/kerghan_standalone/Dockerfile`, built with
`KERGHAN_VERSION=<tag>`. The script runs in this order:

1. **Save the inner images.** For each architecture (amd64, then arm64) it clears
   `standalone/images/<arch>/`, then pulls with `--platform linux/<arch>` and `docker save`s
   `darthjee/kerghan:<tag>`, `mysql:9.3.0` and the Tent image (`darthjee/tent:1.0.3` for amd64,
   `darthjee/tent:1.0.3-arm64` for arm64) as `kerghan.tar`, `mysql.tar` and `tent.tar`. It fails if
   a pulled image's architecture does not match. Each architecture is saved before the next one is
   pulled, because a new pull of the same tag replaces the local copy. The offline stage copies
   `standalone/images/${TARGETARCH:-amd64}/`, so each platform gets its own tarballs. The folder is
   git-ignored.
2. **Build and push** `<tag>` and `<tag>-offline`. The offline build reuses the cached frontend and
   online layers.
3. **Smoke test** the published offline image on the amd64 machine, with `SKIP_BUILD=true` and
   `SMOKE_EXPECT_OFFLINE=true` (`standalone/scripts/smoke_test.sh`). The arm64 image is checked by
   hand.
4. **Promote** `latest` and `latest-offline` with `docker buildx imagetools create`, then
   `imagetools inspect` all four tags so the log shows both platforms.

The versioned tags are pushed before the smoke test, because a multi-arch manifest must be
pushed before it can be pulled. If the smoke test fails, `<tag>` and `<tag>-offline` stay
published and `latest` / `latest-offline` are not moved.

### Production Dockerfile base selection

`darthjee/production_kerghan-base` uses a different tag per architecture (`:<ver>` for amd64,
`:<ver>-arm64` for arm64), so `dockerfiles/production_kerghan/Dockerfile` declares one stage per
architecture (`base-amd64`, `base-arm64`) and selects `FROM base-${TARGETARCH:-amd64} as base`.
BuildKit fills `TARGETARCH` from the target platform and only pulls the stage it needs. The global
`ARG TARGETARCH` deliberately has **no default**: a default would override BuildKit's automatic
value (an arm64 build would silently pick `base-amd64`). The legacy builder leaves it empty, so the
`:-amd64` fallback keeps it on the amd64 base. `BASE_VERSION` defaults to `latest`; only
`release-kerghan` pins it. Note that a local `docker-compose build base_prod_build` on an arm64
host now builds from `production_kerghan-base:latest-arm64`.

### Shared base Dockerfile

All four `*-base` images are built by `bin/image.sh` from the single
`dockerfiles/base/Dockerfile`, selecting the image with `docker build --target <image>`. The
per-image differences (base image, user, home/app/source directories, yarn cache path, rsync pin,
and the user running `yarn_builder.sh`) are build args set per image in the `build_args` function
of `bin/image.sh`; the only per-image content left in the Dockerfile is each target's exec-form
`CMD`. Consequences:

- Since the arg sets live in `bin/image.sh`, `skip_if_unchanged` diffs both `dockerfiles/base/` and
  `bin/image.sh`: a change to either rebuilds all four images on the next tag (`FORCE_IMAGE_BUILD`
  still bypasses the guard).
- The version pins live in one place, as `ARG` defaults at the top of `dockerfiles/base/Dockerfile`:
  `SCRIPTS_IMAGE` (`darthjee/scripts`) and `NODE_IMAGE_VERSION` (used for both `darthjee/node` and
  `darthjee/circleci_node`), so a bump is a one-line edit. The `darthjee/scripts` pin in the leaf
  Dockerfiles is separate and not covered by this.
- `BUILDER_USER` is `root` for `kerghan-base` and `vite_kerghan-base`: `yarn_builder.sh` has to be
  able to write to the root-owned global yarn cache in the node images, otherwise it finds no new
  packages and the pre-warmed cache ends up empty. `production_kerghan-base` and
  `circleci_kerghan-base` keep running it as their own user.

## CI setup pattern (backend/frontend jobs)

`backend_tests`, `backend_checks`, `jasmine` and `frontend-checks` are four workflow entries of one
`yarn_project` job (parameters: `dir` — `backend` | `frontend`, `image`, `script`, `step_name`,
`upload_coverage`), each setting `name:` to the job name shown above. The job runs `checkout`,
the shared `setup_project` command, `npm run <script>`, and — when `upload_coverage` is true — the
best-effort Codacy upload.

`setup_project` (a top-level CircleCI `commands:` entry, also used by `upload_fe_files` with
`dir: frontend`) copies the chosen subdirectory to the workspace root and drops the other one, since
the CI base images expect files there, then runs `yarn install`:

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
| `scripts/deploy.sh` | Trigger and monitor a Render.com deployment (`update_deploy_branch`, `deploy`) |
| `scripts/render.sh` | Render.com API helpers (sourced by `deploy.sh`) |
| `scripts/bump_version.sh` | Bump the version string across the repo |
| `scripts/wake_navi.sh` / `scripts/warm_navi_cache.sh` | Navi cache-warmer scripts — not yet wired into CircleCI, see `docs/agents/cache-warmer.md` |
| `bin/release_kerghan.sh` | Multi-arch buildx release of `darthjee/kerghan` (`release` subcommand), used by `release-kerghan` |
| `bin/release_kerghan_standalone.sh` | Multi-arch release of `darthjee/kerghan-standalone` online and offline (`release` subcommand): saves per-arch inner tarballs, pushes `<tag>`/`<tag>-offline`, smoke-tests, then promotes `latest`/`latest-offline`. Used by `release-kerghan-standalone` |
| `bin/image.sh` | Builds/pushes a `release-image` instance; `skip_if_not_tag`/`skip_if_unchanged` guards, `qemu`/`push` subcommands |
| `bin/deploy_frontend.sh` | SSH-based upload/release helpers used by `upload_proxy_files`, `upload_fe_files`, `upload_extension`, `copy_proxy_configuration`, `release` |

## Migrations on production boot

`dockerfiles/production_kerghan/Dockerfile` sets `dockerfiles/production_kerghan/entrypoint.sh`
as its `ENTRYPOINT`. On container start, the entrypoint runs `yarn migration:run` first and,
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
