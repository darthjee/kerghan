# Infra — CI jobs

The CircleCI job table and per-job details. Part of the [infra architecture hub](../infra.md).

## CI jobs

| Job | Image/Executor | Filter | Purpose |
|-----|-----------------|--------|---------|
| `backend_tests` | `darthjee/circleci_kerghan-base:0.1.0` | every push | `yarn_project` instance (`dir: backend`, `script: coverage`, `upload_coverage: true`): backend test suite + coverage; uploads a partial Codacy coverage report afterward (best-effort, non-blocking) |
| `backend_db_tests` | `darthjee/circleci_kerghan-base:0.1.0` + `mysql:8.4.11` service container | every push | DB-backed backend test tier (`npm run test:db`, no coverage) against a throwaway MySQL reached on `127.0.0.1` — see "`backend_db_tests` — the DB-backed tier" below. Gates the release and deploy jobs |
| `backend_checks` | `darthjee/circleci_kerghan-base:0.1.0` | every push | `yarn_project` instance (`dir: backend`, `script: lint`): backend ESLint |
| `jasmine` | `darthjee/circleci_node:0.2.1` | every push | `yarn_project` instance (`dir: frontend`, `script: coverage`, `upload_coverage: true`): frontend test suite + coverage; uploads a partial Codacy coverage report afterward (best-effort, non-blocking) |
| `frontend-checks` | `darthjee/circleci_node:0.2.1` | every push | `yarn_project` instance (`dir: frontend`, `script: lint`): frontend ESLint |
| `proxy_extension_tests` | `darthjee/tent-test:1.0.3` | every push | PHPUnit tests for `proxy/extension/` |
| `coverage-final` | `darthjee/circleci_kerghan-base:0.1.0` | every push | Finalizes the aggregated Codacy coverage report once `backend_tests`/`jasmine`'s partial uploads land (best-effort, non-blocking) |
| `release-image` | machine (multi-arch: amd64 + arm64) | every push (no-op unless tag) | Publishes one of the 4 base images to Docker Hub via `bin/image.sh`; instantiated through a single workflow `matrix` (4 images × 2 archs = 8 jobs) — see below |
| `release-kerghan` | machine (`ubuntu-2204:current`, multi-arch: amd64 + arm64) | tag only | Builds and pushes `darthjee/kerghan:<tag>` and `:latest` as one multi-arch manifest via `bin/release_kerghan.sh release` (buildx, `docker-container` builder) — see below |
| `release-kerghan-standalone` | machine (`ubuntu-2204:current`, multi-arch: amd64 + arm64) | tag only | Requires `release-kerghan`. Publishes `darthjee/kerghan-standalone` online and offline via `bin/release_kerghan_standalone.sh release`; smoke-tests the offline image before moving `latest`/`latest-offline` — see below |
| `release-kerghan-assets` | `cimg/base:stable` | tag only | Requires `release-kerghan-standalone`. Publishes the client assets (`kerghan`, `install.sh`, `config.example`, `SHA256SUMS`) to the GitHub release of the tag via `bin/release_kerghan_assets.sh release` — see below |
| `standalone_tests` | `bats/bats:1.11.0` | every push | bats suite for the standalone client and installer (`bats standalone/test`) |
| `scripts_tests` | `bats/bats:1.11.0` | every push | bats suite for the Render deploy scripts (`bats scripts/test`); locally `docker-compose run --rm scripts_tests` |
| `build-and-release` | machine (`ubuntu-2204:current`, for `curl --fail-with-body`) | tag only | Requires `release-kerghan`. Checks the thin Render Dockerfile is `FROM darthjee/kerghan:<tag>`, moves the Render service branch to the tag and triggers a deploy (`scripts/deploy.sh deploy`), blocks until it reports "live" — see "Render deploy" |
| `upload_proxy_files` | `darthjee/tent:1.0.3` | tag only | Uploads Tent proxy runtime to the SSH deploy host's staging dir |
| `upload_fe_files` | `darthjee/vite_kerghan-base:0.1.0` | tag only | Builds the Vite frontend, uploads the static output to the staging dir |
| `upload_extension` | `darthjee/tent:1.0.3` | tag only | Uploads the proxy PHP extension (test files stripped) |
| `copy_proxy_configuration` | `darthjee/tent:1.0.3` | tag only | Uploads prod proxy config + restores host-only state (`locals.php`, `.htaccess`) |
| `release` | `darthjee/vite_kerghan-base:0.1.0` | tag only | Atomic swap: only runs once every upload/build job above has succeeded |

### `backend_db_tests` — the DB-backed tier

A standalone job (not a `yarn_project` instance, whose `docker:` takes a single image). The
primary container is `darthjee/circleci_kerghan-base:0.1.0`; a secondary `mysql:8.4.11` container
(`MYSQL_DATABASE=kerghan_test`, `MYSQL_USER`/`MYSQL_PASSWORD`/`MYSQL_ROOT_PASSWORD=kerghan`, no
volume) shares its network, so the tests reach it on `127.0.0.1`. The primary container sets the
app's own connection variables to the test database:

| Var | Value |
|---|---|
| `KERGHAN_MYSQL_HOST` | `127.0.0.1` |
| `KERGHAN_MYSQL_PORT` | `3306` |
| `KERGHAN_MYSQL_USER` | `kerghan` |
| `KERGHAN_MYSQL_PASSWORD` | `kerghan` |
| `KERGHAN_MYSQL_NAME` | `kerghan_test` |

There is no wait step: the tier's Jest `globalSetup` retries the connection for up to 60 s, and
refuses to run unless `KERGHAN_MYSQL_NAME` ends in `_test`. The job uploads no coverage, so it
stays out of `coverage-final`; it is required by `build-and-release`, `release-kerghan`,
`upload_proxy_files` and `upload_fe_files`, like `backend_tests`.

Locally, the same tier runs with `make db-tests` (`docker-compose run --rm kerghan_db_tests`),
against the `kerghan_mysql_test` service: `mysql:8.4.11`, data dir on `tmpfs`, no published port
and no `env_file`. `kerghan_db_tests` reaches it through the `mysql_test` link alias.

### MySQL version

Dev (`kerghan_mysql`), the local test database (`kerghan_mysql_test`) and CI (`backend_db_tests`)
all use `mysql:8.4.11`, which matches production. The standalone image also uses `mysql:8.4.11`
(`mysql:9.3.0` is bundled as `mysql-legacy.tar` only for the one-time migration; see the
migration section in [standalone.md](../../standalone/inner-stack.md#mysql-93-to-8411-migration)).

**One-time dev reset.** #462 moved `kerghan_mysql` from `9.3.0` to `8.4.11`. MySQL cannot
downgrade a data directory, so an existing `docker_volumes/mysql_data` will not start on the new
image. Recreate it once (this deletes your local dev data):

```sh
docker-compose stop kerghan_mysql
rm -rf docker_volumes/mysql_data
docker-compose up -d kerghan_mysql
make setup
```

`make setup` runs `yarn migration:run`.

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
| `release-production_kerghan-base(-arm64)` | `production_kerghan-base` | Production backend base image (the `darthjee/kerghan` production image, built from `dockerfiles/release_kerghan/`, is `FROM` this — `:latest` by default, pinned to the `version` file only in `release-kerghan`; the per-arch tag is picked from `TARGETARCH`) |
| `release-vite_kerghan-base(-arm64)` | `vite_kerghan-base` | Frontend/proxy build base image |

The backend image family (`kerghan-base`, `circleci_kerghan-base`, `production_kerghan-base`)
is built in CI but **not actually published to Docker Hub** — only the frontend/proxy
(`vite_kerghan*`) images are. `bin/image.sh` still runs the `release-image` job for all of them
so the ordering/`requires` machinery stays uniform; see `docs/agents/environment-variables.md`
for which Docker Hub credentials are actually wired up.

### Leaf image tags and the one-time stale-image cleanup

The leaf images keep their `dockerfiles/` folder names but are tagged differently (#339):
`dockerfiles/kerghan/` builds the local dev image `darthjee/dev_kerghan` (compose `base` /
`base_build`, `make build`), and `dockerfiles/release_kerghan/` builds the production image
`darthjee/kerghan` (compose `base_prod` / `base_prod_build`). `dockerfiles/production_kerghan/`
only holds the thin Dockerfile Render builds (`FROM darthjee/kerghan:<tag>`, see "Render
deploy"). `darthjee/kerghan` is published to Docker Hub by `release-kerghan` (see below);
`darthjee/dev_kerghan` is never pushed.

Before #339 the dev image was tagged `darthjee/kerghan`. A developer who still has that old local
tag would have `base_prod` run the stale dev image under the production tag, so remove it and
rebuild once:

```bash
docker image rm darthjee/kerghan
docker-compose build base_prod_build   # rebuilds darthjee/kerghan (production)
docker-compose build base_build        # rebuilds darthjee/dev_kerghan (dev)
```

