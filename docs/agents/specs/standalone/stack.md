# Standalone stack and Dockerfile

Read by #342 (stack and Dockerfile) and #343 (release). See the [README](README.md) for the
feature overview, [images.md](images.md) for tags and pins, and [variables.md](variables.md) for
what each service receives.

## Vault basics relevant here

See [docs/agents/external/vault.md](../../external/vault.md) and its pages. In short:

- Vault starts its own Docker daemon, optionally loads image tarballs from `/vault/images/`, then
  runs `docker compose` from `/vault`.
- Bind mounts in the inner compose file resolve against the Vault container's filesystem, so
  `/vault/tent/` is mountable into an inner service.
- Inner images and volumes persist in Vault's `/var/lib/docker` data volume
  (`vault-kerghan-data` when run by the `kerghan` client).
- Vault needs the Sysbox runtime or `--privileged`.

## Inner services

| Service | Image | Notes |
|---|---|---|
| `mysql` | `mysql:9.3.0` | Internal only, never published. Healthcheck. Data in an inner named volume (inside `/var/lib/docker`). |
| `kerghan` | `darthjee/kerghan:${KERGHAN_VERSION}` (`<v>`, from `/vault/.env`) | Runs migrations on boot. `depends_on: { mysql: { condition: service_healthy } }`. `restart: unless-stopped`. Environment per [variables.md](variables.md). |
| `tent` | `${TENT_IMAGE}` (stock `darthjee/tent`) | No custom proxy image. Tent standalone configuration (`/vault/tent/configuration/`), the built frontend (`/vault/tent/static/`) and Kerghan's Tent extension (`/vault/tent/extension/`) come from `/vault/tent/`, bind-mounted read-only. `$backendHost=http://kerghan:3000/`. Published on Vault port 80. `restart: unless-stopped`. |

- The Tent standalone configuration routes `*.json` to the backend and serves the frontend's
  static files otherwise, like production, with no Navi and no `/admin`.
- The Tent standalone configuration lives in `standalone/vault/tent/configuration/`. It mirrors
  `proxy/prod_configuration/` (same rules, middlewares and CSP) and must be kept in sync with it;
  only its committed `locals.php` (no secrets) differs.
- The production rules use Kerghan's custom Tent middlewares (`SetClientIpMiddleware`,
  `CacheControlMiddleware`, `SetResponseHeadersMiddleware`), which the stock Tent image does not
  ship. The Dockerfile therefore copies the runtime part of `proxy/extension/` (`loader.php` and
  `lib/`, no tests) to `/vault/tent/extension/`, mounted at `/var/www/html/extension`. No copy is
  committed under `standalone/`, so the extension never drifts from `proxy/`.
- The built frontend is produced at image build time by a `frontend` stage
  (`FROM --platform=$BUILDPLATFORM darthjee/vite_kerghan-base:0.1.0`, `yarn build`) and lands in
  `/vault/tent/static/` (`standalone/vault/tent/static/` is git-ignored). That base tag is
  amd64-only, so an arm64 build host runs the stage under emulation.

## Multi-arch Tent

`darthjee/tent` publishes separate tags (`1.0.3` amd64, `1.0.3-arm64` arm64), not a manifest.

- The standalone Dockerfile uses `TARGETARCH` at build time to write `/vault/.env` with
  `TENT_IMAGE=darthjee/tent:1.0.3` (amd64) or `TENT_IMAGE=darthjee/tent:1.0.3-arm64` (arm64).
- The inner compose file uses `image: ${TENT_IMAGE}`. Compose reads `/vault/.env` automatically.
  That file holds no secrets.
- For the offline variant, CI saves the tag matching each architecture.

## Dockerfile targets

`dockerfiles/kerghan_standalone/Dockerfile`, one file, two targets:

- **`standalone`**: `FROM darthjee/vault:0.1.0`; copies `standalone/vault/` (with the built
  frontend) to `/vault`; writes `/vault/.env` with `TENT_IMAGE` (as above) and
  `KERGHAN_VERSION` (build arg, default `latest`), failing the build on an unsupported
  `TARGETARCH`.
- **`standalone-offline`**: `FROM standalone`; adds the inner image tarballs to `/vault/images/`
  (copied from `standalone/images/`, git-ignored, which must hold the `*.tar` files before this
  target is built) and sets `ENV COMPOSE_UP_ARGS="--pull never"`.

No secret is baked into either target; the per-Dockerfile ignore file
(`dockerfiles/kerghan_standalone/Dockerfile.dockerignore`) excludes env files.

## Offline preload

- Tarballs in `/vault/images/` are the only supported preload mechanism (Vault's own). CI runs
  `docker save` on `darthjee/kerghan:<v>`, `mysql:9.3.0` and the matching Tent tag, per
  architecture.
- Rejected: pre-populating `/var/lib/docker` at build time (fragile, needs a privileged build); a
  bundled registry or building from source at start (no gain).
- Accepted costs: image data stored twice (tarball plus loaded image); `docker load` runs on
  every start.

## Same-origin and OriginGuard

- Tent serves the frontend and the API from one origin, so CORS stays disabled.
- Verified: modern browsers send `Sec-Fetch-Site: same-origin`, so `OriginGuard` accepts writes
  with no configuration.
- Older browsers without that header fall back to comparing `Origin` with `Host`. Tent rewrites
  `Host` to the backend host (`default_proxy`, by design), so those writes would be rejected.
  Production has the same limitation today.
- Decision: the `kerghan` client passes `FRONTEND_BASE_URL=http://localhost:<port>` by default
  (see [client.md](client.md)), which makes `OriginGuard` trust that origin. Plain `docker run`
  users set it themselves (see [variables.md](variables.md)).

## Edge cases

- **First boot ordering:** the `mysql` healthcheck plus `depends_on: service_healthy` and
  `restart: unless-stopped` keep a migration run against a not-yet-ready database from leaving
  the stack dead.
- **A migration fails during an upgrade:** visible through `kerghan status` / `kerghan logs`.
  Recovery is to fix forward with the next release.
- **Switching between online and offline** is supported on the same data volume: the images and
  tags are the same.
- **Disk growth:** older inner images accumulate in the data volume, and the offline variant
  stores image data twice. Documented, with a manual cleanup command (e.g. pruning images inside
  the instance through `kerghan compose` or `docker exec`). Automatic pruning is out of scope.
- **arm64 hosts:** supported; every inner image has an arm64 build (see
  [images.md](images.md#pinned-images)).
- **Unsupported environments** (Windows, rootless Docker, no Sysbox and no `--privileged`):
  refused with a clear error by the installer or by `vault`. Documented.

## Required tests

- The standalone image boots with `--privileged`, waits for the stack, then checks the backend
  health endpoint (`/health.json`) and the frontend, both through Tent on port 80. Implemented by
  `standalone/scripts/smoke_test.sh`, run locally with `make standalone-smoke` (#342); the CI job
  running it comes with #343.
- Data survives a restart when the data volume is kept (covered by the same smoke test).
- The offline variant starts with no network access, on amd64 and on arm64.
- The image selects the Tent tag matching its architecture.
- No secret or env file is present in either image.
