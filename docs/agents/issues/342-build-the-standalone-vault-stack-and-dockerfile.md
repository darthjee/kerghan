# Issue: Build the standalone Vault stack and Dockerfile

## Description

Part of epic #336. Build the Vault-based standalone stack: one container
(`darthjee/kerghan-standalone`) running MySQL, the Kerghan backend and Tent (serving the frontend
and proxying the API). Specs: `docs/agents/specs/standalone/stack.md`, `images.md`,
`variables.md`.

**Owner:** `standalone` agent (owns `standalone/` and `dockerfiles/kerghan_standalone/`).

**Depends on:** #338 (the `standalone` agent) and #340 (release `darthjee/kerghan`), both merged.

## Problem

Running Kerghan today needs the full dev/production setup (separate MySQL, backend, proxy).
There is no single image a user can `docker run` to get a working instance.

## Expected Behavior

- `docker run --privileged -v kerghan-data:/var/lib/docker -p 3000:80 -e KERGHAN_SECRET_KEY=... -e KERGHAN_INTEGRATIONS_KEY=... <image>`
  serves the app on `http://localhost:3000`, with login working.
- Data survives a restart when the data volume is kept.
- The image selects the Tent tag matching its architecture.
- No secret or env file is present in the image.
- A variable outside the allowlist, set on the Vault container, does not reach the backend; an
  allowlisted one does, and an unset one is absent (not empty).
- The internal fixed values cannot be overridden from the Vault container's environment.

## Solution

### Inner compose stack (`standalone/vault/`, copied to `/vault`)

- `mysql` (`mysql:9.3.0`, pinned): internal only, never published. Data lives in an inner
  named volume, persisted through Vault's `/var/lib/docker` data volume. It has a
  healthcheck.
- `kerghan` (`image: darthjee/kerghan:${KERGHAN_VERSION}`): runs migrations on boot.
  `depends_on: { mysql: { condition: service_healthy } }`, `restart: unless-stopped`.
- `tent` (stock Tent image, no custom image; `image: ${TENT_IMAGE}`, see Multi-arch below): the
  built Vite frontend and a Tent **standalone** configuration ship in `standalone/vault/tent/` and
  are bind-mounted into the container (relative paths resolve against `/vault`).
  `$backendHost=http://kerghan:<port>`. Routes `*.json` to the backend and serves the frontend's
  static files otherwise, like production, with no Navi and no `/admin`. Published on Vault port
  80. `restart: unless-stopped`.

### Environment contract (see `variables.md`)

- Required secrets, passed at run time: `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY`.
- Fixed internally: `KERGHAN_MYSQL_HOST=mysql`, `KERGHAN_MYSQL_PORT=3306`,
  `KERGHAN_MYSQL_NAME` / `KERGHAN_MYSQL_USER`, `PORT`, `NODE_ENV=production`,
  `KERGHAN_EMAILS_ENABLED=false`.
- `KERGHAN_MYSQL_PASSWORD` (also used for `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD`): a default
  that the user may override.
- Optional pass-through, listed **by name only** in `environment:` (an explicit allowlist):
  `FRONTEND_BASE_URL`, `KERGHAN_ALLOWED_ORIGINS`, `KERGHAN_LOG_LEVEL`, TTL / rate-limit /
  integrations tuning, the GitHub OAuth App and GitHub App sets, `KERGHAN_PREVIOUS_*`.
- No secret is baked into the image. Add a `.dockerignore` that excludes env files.

### Image version (`KERGHAN_VERSION`)

- The Dockerfile takes a `KERGHAN_VERSION` build arg (default `latest`) and writes it to
  `/vault/.env` next to `TENT_IMAGE`. The inner compose file uses
  `image: darthjee/kerghan:${KERGHAN_VERSION}`.
- The release (#343) passes the semver tag, so `darthjee/kerghan-standalone:<v>` always runs
  `darthjee/kerghan:<v>`.
- Update the specs to match: `stack.md` (`/vault/.env` also holds `KERGHAN_VERSION`) and
  `images.md` (the "references `darthjee/kerghan:<v>`" test checks `/vault/.env`, not the compose
  file).

### Dockerfile (`dockerfiles/kerghan_standalone/Dockerfile`)

- `FROM darthjee/vault:0.1.0` (pinned), with two targets:
  - `standalone`: copies `standalone/vault/` (with the built frontend) to `/vault` and writes
    `/vault/.env` (`TENT_IMAGE`, `KERGHAN_VERSION`; no secrets);
  - `standalone-offline`: `FROM standalone`, adds `images/*.tar` to `/vault/images/` and
    `ENV COMPOSE_UP_ARGS="--pull never"`. **#342 only defines this target**; producing the
    tarballs and testing an offline boot (amd64 and arm64) belong to #343.
- The frontend build step (Vite) is part of the image build (multi-stage).

### Multi-arch

- `darthjee/tent` publishes separate tags (`1.0.3` for amd64, `1.0.3-arm64` for arm64), not a
  multi-arch manifest. The Dockerfile uses `TARGETARCH` at build time to write
  `TENT_IMAGE=darthjee/tent:1.0.3` or `darthjee/tent:1.0.3-arm64` into `/vault/.env`. Compose
  reads `/vault/.env` automatically.
- `darthjee/vault:0.1.0` and `mysql:9.3.0` are multi-arch.

### Same-origin writes (`OriginGuard`)

Verified in #337: modern browsers send `Sec-Fetch-Site: same-origin`, so writes through Tent
pass with no configuration. Older browsers fall back to comparing `Origin` with `Host`, which
Tent rewrites to the backend host, so they need `FRONTEND_BASE_URL` to match the public origin.
The `kerghan` client sets it by default. Users of plain `docker run` pass it themselves.

### Verification

- A documented `make` target builds the `standalone` image, runs it with `--privileged`, waits
  for the stack, and checks that the backend health endpoint (`/health.json`) and the frontend
  respond through Tent on port 80.
- The smoke test boots the latest published `darthjee/kerghan` (`KERGHAN_VERSION=latest`, or a
  given version); it tests the stack wiring, not unreleased backend code.
- The CircleCI smoke job is **out of scope** here: it lands with the release work in #343, which
  owns the CI pipeline.

### Out of scope

- CI jobs, release/push of `darthjee/kerghan-standalone`, offline tarballs and offline boot tests
  (#343).
- The `kerghan` client CLI and installer (#344 and later).

## Benefits

- A single `docker run` gives a full, persistent Kerghan instance, on amd64 and arm64.
- The stack reuses stock images (`darthjee/kerghan`, `darthjee/tent`, `mysql`), so there is no
  custom proxy image to maintain.
