# Standalone Distribution

The permanent reference for running Kerghan standalone: the `darthjee/kerghan-standalone` image,
the `kerghan` client, its installer and the `~/.kerghan/` configuration. The user-facing summary
is the "Run Kerghan standalone" section of the [README](../../README.md#run-kerghan-standalone);
the environment-variable contract is in
[environment-variables.md](environment-variables.md#5-standalone-darthjeekerghan-standalone).
The `standalone` agent owns the files described here; the CI release jobs belong to `infra` (see
[architecture/infra.md](architecture/infra.md)).

## Overview

Kerghan ships as two public Docker images, plus a client and an installer:

- **`darthjee/kerghan`**: the production backend image (NestJS, runs migrations on boot), built
  from `dockerfiles/release_kerghan/Dockerfile`. Render deploys it, and the standalone image
  runs it as an inner service.
- **`darthjee/kerghan-standalone`**: a [Vault](external/vault.md) image
  (`FROM darthjee/vault`) that runs the whole stack in one container: MySQL, the backend, and Tent
  serving the built frontend, on a single port. It comes in an online and an offline variant.
- **`kerghan`**: a thin bash client wrapping the `vault` CLI (`standalone/bin/kerghan`), so a user
  runs all of Kerghan with one command.
- **`install.sh`**: installs the client, and the `vault` CLI when it is missing
  (`standalone/install.sh`).

The goal is one artifact that runs all of Kerghan for self-hosting and local use.

### Why Vault

- **Chosen: a Vault image.** One image, one container, one exposed port. It reuses the compose
  stack and each service's own image unchanged, and the client can wrap the `vault` CLI. Accepted
  costs: it needs Sysbox or `--privileged` (so no Render, no rootless Docker, no Windows),
  Docker-in-Docker adds weight, and the offline variant stores image data twice.
- **Possible later fallback: a released compose bundle.** The inner compose file plus the frontend
  and Tent files as a release asset, run with `docker compose` on the host, with no privileges.
  The compose file inside the standalone image is essentially this bundle.
- **Rejected:** a fat single image (MySQL, Node and Tent under a process supervisor), an external
  database (not standalone), and Helm or Kubernetes manifests (overkill for self-hosting).

### Out of scope

Navi (the cache warmer), phpMyAdmin, email (`KERGHAN_EMAILS_ENABLED` stays off), shell
completion, a backup command, several instances per host, and production use. Production keeps
its own deploy (see [architecture/infra.md](architecture/infra.md)); Render never runs the Vault
image.

## Requirements

- A Linux or macOS host. Windows and rootless Docker are not supported.
- Docker, with the [Sysbox](https://github.com/nestybox/sysbox) runtime or `--privileged`
  containers allowed. The daemon must be reachable by the current user.
- For the client: `vault`, `docker` and `openssl` on the host, and bash 3.2 or later. The
  installer installs `vault` when it is missing.

## Install and upgrade

### Installing the client

```bash
curl -fsSL https://github.com/darthjee/kerghan/releases/latest/download/install.sh | bash
```

`install.sh`:

1. Checks the OS is Linux or macOS.
2. Checks Docker is installed and the daemon is reachable.
3. Downloads the `kerghan` client of the requested version from
   `https://github.com/darthjee/kerghan/releases/download/<version>/kerghan` and installs it,
   executable, into the install directory. When that directory is not on `PATH`, it prints a
   warning with the `export PATH=...` line to add.
4. Installs the `vault` CLI when it is not on `PATH`, through Vault's own installer, pinned to the
   Vault version the standalone image is built on (`VAULT_VERSION="0.1.0"`, matching
   `FROM darthjee/vault:0.1.0`). The Vault installer is downloaded to a file, never piped into
   `bash`. An existing `vault` is left alone.

It never uses `sudo` and never touches `~/.kerghan/` or any Docker volume.

| Variable | Effect | Default |
|---|---|---|
| `KERGHAN_VERSION` | Release to install. | The version stamped in `install.sh` by `scripts/bump_version.sh` |
| `KERGHAN_INSTALL_DIR` | Directory the client is installed to. | `~/.local/bin` |

For example: `curl -fsSL .../install.sh | KERGHAN_VERSION=0.5.0 bash`.

Each of these errors exits 1 with a message, and leaves no partial install: an unsupported OS,
Docker missing or its daemon unreachable, an install directory that cannot be created or is not
writable, and a failed download. The client is only moved into the install directory once every
download succeeded.

### Verifying the release assets

Each release carries a `SHA256SUMS` file (see
[architecture/infra.md](architecture/infra.md#release-kerghan-assets--client-assets-on-the-github-release)).
To check the installer before running it:

```bash
curl -fsSLO https://github.com/darthjee/kerghan/releases/download/<version>/install.sh
curl -fsSLO https://github.com/darthjee/kerghan/releases/download/<version>/SHA256SUMS
sha256sum -c --ignore-missing SHA256SUMS          # Linux
shasum -a 256 -c --ignore-missing SHA256SUMS      # macOS
bash install.sh
```

`--ignore-missing` lets the check pass when only some of the assets were downloaded.

### Upgrading

1. Run the installer again. It replaces the client in place (with the latest release, or with
   `KERGHAN_VERSION`).
2. Run `kerghan up`. When the running instance uses an older image than the new client, the client
   recreates it (`down`, then `up`) with the new image. The data volume is kept, and the backend
   runs the pending migrations on boot.

**Downgrades are not supported** (an older image against a newer schema). When the running
instance uses a newer image than the client (or than `image-tag`), `kerghan up` prints a warning
and a hint, exits non-zero, and does not touch the instance.

## The `kerghan` client

```
kerghan up [--offline] [-p PORT] [-f]   # start (detached by default) on http://localhost:3000
kerghan down                            # stop and remove the container; data is kept
kerghan logs [-f]                       # show (or follow) the logs
kerghan status                          # show the instance state
kerghan compose <args>                  # docker compose inside the instance, e.g. compose exec mysql sh
kerghan reset                           # wipe all data, asks for confirmation
kerghan version | help
```

- `-p` / `--port` sets the host port, `--offline` selects the offline image variant for this run,
  and `-f` runs in the foreground.
- An unknown command or option prints the usage and exits 2.

### Mapping to `vault`

Every command calls `vault` with the fixed instance name `kerghan`, which gives the container
`vault-kerghan` and the data volume `vault-kerghan-data`:

```
vault up --name kerghan --image darthjee/kerghan-standalone:<tag>[-offline] \
  --env-file ~/.kerghan/kerghan.env -p <port>:80 [-e FRONTEND_BASE_URL=http://localhost:<port>] \
  --runtime <runtime> --stop-timeout <seconds> [-f]
vault down --name kerghan --stop-timeout <seconds>
vault logs|status|compose --name kerghan ...
```

- `<tag>` is the version pinned in the client (`KERGHAN_VERSION`, stamped by
  `scripts/bump_version.sh`), so client `<v>` runs image `<v>`. `image-tag` in the config
  overrides it.
- The online and offline variants share the instance name and the data volume, so switching
  between them keeps the data.
- `--runtime` and `--stop-timeout` come from the config (defaults `auto` and `60`). The stop
  timeout is passed on every `down`: `kerghan down`, the `down` before a recreation, and `reset`.
- `vault` always runs from `~/.kerghan`, so a stray `.vaultrc` or `.vault.env` in the user's
  working directory cannot change the instance.

### Secrets

On the first `up`, when `~/.kerghan/kerghan.env` does not exist and no data volume exists, the
client creates `~/.kerghan/` and writes `kerghan.env` (mode 600) with `KERGHAN_SECRET_KEY` and
`KERGHAN_INTEGRATIONS_KEY`, each from `openssl rand -base64 32`. It never regenerates or rewrites
an existing file.

`up` refuses to start (exit 1, no container created) when `kerghan.env` is missing but the
`vault-kerghan-data` volume exists: the data was written with secrets that are gone. The hint
says to restore the file from a backup, or to run `kerghan reset`.

### `FRONTEND_BASE_URL`

`up` passes `FRONTEND_BASE_URL=http://localhost:<port>` (the effective port) unless
`kerghan.env` sets `FRONTEND_BASE_URL` itself. See
[Same origin and `OriginGuard`](#same-origin-and-originguard) for why.

### `up`: start, no-op or recreate

When the instance is already running, `up` compares the running image and port with the wanted
ones (from the flags, the config and the defaults):

- Same image and port: nothing to do (`Kerghan is already running at ...`).
- An older image (upgrade), the other variant, or another port: the instance is recreated, and the
  data volume is kept.
- A newer image: the downgrade warning above, and no change.
- A non-semver tag (for example `image-tag=latest`): the version comparison and the downgrade
  guard are skipped; `up` only checks that the running image reference and port match, and
  recreates otherwise.

A changed `runtime` or `stop-timeout` never triggers a recreation; it applies the next time the
container is created (`kerghan down && kerghan up` applies it now).

### Other behavior

- **Port in use:** Vault's error is shown, with the hint
  `use 'kerghan up -p <port>' or set port= in ~/.kerghan/config to pick another port`.
- **`reset`:** asks `Continue? [y/N]` (default no), then stops the instance and removes
  `vault-kerghan-data`. It keeps `kerghan.env`.
- **`status` / `logs`:** the way to see a failed migration or an unhealthy service.

## Configuration (`~/.kerghan/`)

| File | Content | Mode |
|---|---|---|
| `~/.kerghan/config` | Client settings. Optional. | user default |
| `~/.kerghan/kerghan.env` | Secrets and backend variables passed to the stack (see [environment-variables.md](environment-variables.md#5-standalone-darthjeekerghan-standalone)). Generated on the first `up`. | 600 |

### `config` format

Flat `key=value`, one per line. Blank lines and `#` comments (whole line or trailing) are ignored,
and surrounding whitespace is trimmed. An empty value means "use the default".

```
port=3000
variant=online        # online | offline
runtime=auto          # auto | sysbox | privileged
stop-timeout=60
image-tag=            # optional override of the pinned image tag
```

| Key | Values | Default | Overridden by | Passed to Vault as |
|---|---|---|---|---|
| `port` | 1–65535 | `3000` | `-p PORT` | `-p <port>:80` (and `FRONTEND_BASE_URL`) |
| `variant` | `online` \| `offline` | `online` | `--offline` | the `-offline` image suffix |
| `runtime` | `auto` \| `sysbox` \| `privileged` | `auto` (Sysbox when installed, else `--privileged`) | none | `--runtime` on `up` |
| `stop-timeout` | seconds, positive integer | `60` | none | `--stop-timeout` on `up` and every `down` |
| `image-tag` | a Docker tag, or empty | the tag pinned in the client | none | the image tag |

- **Precedence:** command-line flag, then `~/.kerghan/config`, then the default. `--offline`
  selects the offline variant even with `variant=online`; with `variant=offline`, a run without
  the flag uses the offline variant.
- **`image-tag`** must be a valid Docker tag (`[A-Za-z0-9_.-]`, not starting with `.` or `-`, at
  most 128 characters) and must not end in `-offline`. It replaces only the version part:
  `image-tag=0.4.0` with `--offline` runs `darthjee/kerghan-standalone:0.4.0-offline`. An `x.y.z`
  tag gets the usual upgrade and downgrade rules; any other tag skips them (see
  [`up`](#up-start-no-op-or-recreate)).
- **Which commands read it:** only `up`, `down` and `reset` load the file, before any side effect
  (in `reset`, before the confirmation prompt). `version`, `help`, `logs`, `status` and `compose`
  never read it, so a broken config does not block them.
- **Malformed input:** a line without `=`, or an invalid value for a known key (for example
  `port=abc`), fails with the file name and line number, and the command exits 1 without touching
  the instance. An unknown key only prints a warning, so an older client still works with a config
  written for a newer one. A missing file is not an error.

`standalone/config.example` documents every key, its default, its allowed values and the flag
that overrides it. It ships as the `config.example` release asset; copy it to
`~/.kerghan/config` and uncomment what you want to change.

The format is flat `key=value` because every setting is flat and it parses in plain bash. JSON
(needs `jq`) and YAML (needs a parser such as `yq`) were rejected; reconsider only if nesting is
ever needed.

## Inner stack

Vault starts its own Docker daemon, loads any image tarballs from `/vault/images/`, then runs
`docker compose up` from `/vault`. Bind mounts in the inner compose file resolve against the Vault
container's filesystem. Inner images and volumes live in Vault's `/var/lib/docker`, which is the
`vault-kerghan-data` volume when the client runs it. See the [Vault guide](external/vault.md).

The inner compose file is `standalone/vault/docker-compose.yml`, copied to `/vault`:

| Service | Image | Notes |
|---|---|---|
| `mysql` | `mysql:9.3.0` | Internal only, never published. Healthcheck (`mysqladmin ping`). Data in the inner `mysql-data` volume. |
| `kerghan` | `darthjee/kerghan:${KERGHAN_VERSION}` | Runs migrations on boot. Waits for `mysql` to be healthy. Receives only the allowlisted environment (see [environment-variables.md](environment-variables.md#5-standalone-darthjeekerghan-standalone)). |
| `tent` | `${TENT_IMAGE}` (stock `darthjee/tent`) | Published on Vault port 80. Serves the frontend and proxies `*.json` to `http://kerghan:3000/`. |

All three use `restart: unless-stopped`. With the healthcheck and `depends_on`, a backend started
before MySQL is ready retries instead of leaving the stack dead.

### Tent and the frontend

`tent` uses the stock Tent image, with three read-only bind mounts from `/vault/tent/`:

| Mount | Source | Content |
|---|---|---|
| `/var/www/html/configuration` | `standalone/vault/tent/configuration/` | The Tent standalone configuration |
| `/var/www/html/static` | built at image build time | The built frontend (`yarn build`) |
| `/var/www/html/extension` | copied from `proxy/extension/` at image build time | Kerghan's Tent middlewares (`loader.php` and `lib/`, no tests) |

- The Tent standalone configuration mirrors `proxy/prod_configuration/` (same rules, middlewares
  and CSP; `*.json` to the backend, static files otherwise, no Navi, no `/admin`). Only its
  committed `locals.php` (no secrets) differs. **Keep it in sync** with
  `proxy/prod_configuration/` when the production rules change.
- The extension is copied from `proxy/extension/` at build time, and no copy is committed under
  `standalone/`, so it never drifts. `standalone/vault/tent/static/` and
  `standalone/vault/tent/extension/` are git-ignored.

### `/vault/.env` and multi-arch Tent

`darthjee/tent` publishes one tag per architecture (`1.0.3` for amd64, `1.0.3-arm64` for arm64),
not a manifest. The Dockerfile uses `TARGETARCH` to write `/vault/.env`, which `docker compose`
reads automatically. It holds no secrets:

```
TENT_IMAGE=darthjee/tent:1.0.3          # or darthjee/tent:1.0.3-arm64
KERGHAN_VERSION=<v>                      # the darthjee/kerghan tag baked into this image
```

An unsupported `TARGETARCH` fails the build.

### Dockerfile targets

`dockerfiles/kerghan_standalone/Dockerfile` (build context: the repo root, BuildKit required):

- **`frontend`** stage: `FROM --platform=$BUILDPLATFORM darthjee/vite_kerghan-base:0.1.0`, runs
  `yarn build`. That base tag is amd64-only, so an arm64 build host runs it under emulation.
- **`standalone`** (online): `FROM darthjee/vault:0.1.0`; copies `standalone/vault/` to `/vault`,
  the built frontend to `/vault/tent/static/` and the Tent extension to `/vault/tent/extension/`;
  writes `/vault/.env` (`KERGHAN_VERSION` is a build arg, default `latest`). Vault pulls the inner
  images on the first start.
- **`standalone-offline`**: `FROM standalone`; copies `standalone/images/<arch>/` (picked by
  `TARGETARCH`, `amd64` when unset) to `/vault/images/`, and sets
  `ENV COMPOSE_UP_ARGS="--pull never"`.

No secret is baked into either target: `dockerfiles/kerghan_standalone/Dockerfile.dockerignore`
excludes env files.

### Online and offline variants

- **Online** (`darthjee/kerghan-standalone:<v>`): small image; the first start pulls
  `darthjee/kerghan:<v>`, `mysql:9.3.0` and the Tent image.
- **Offline** (`darthjee/kerghan-standalone:<v>-offline`): the inner images are preloaded as
  tarballs (`kerghan.tar`, `mysql.tar`, `tent.tar`, one set per architecture, written by
  `bin/release_kerghan_standalone.sh` with `docker save`). Vault runs `docker load` on every
  start, and `--pull never` keeps it off the network. Use it on hosts without access to Docker
  Hub. Costs: a larger image, image data stored twice (tarball plus loaded image), and a slower
  start.

Both variants use the same images and tags, so switching between them on the same data volume is
supported. Tarballs in `/vault/images/` are the only preload mechanism; pre-populating
`/var/lib/docker` at build time was rejected (fragile, needs a privileged build).

### Same origin and `OriginGuard`

Tent serves the frontend and the API from one origin, so CORS stays disabled. Modern browsers send
`Sec-Fetch-Site: same-origin`, which `OriginGuard` accepts with no configuration. Older browsers
without that header fall back to comparing `Origin` with `Host`, and Tent rewrites `Host` to the
backend host, so those writes would be rejected (production has the same limitation). The client's
default `FRONTEND_BASE_URL=http://localhost:<port>` makes `OriginGuard` trust that origin, and
also gives the backend the base URL for password-reset links and the GitHub callback URLs. Plain
`docker run` users set it themselves.

## Images and versioning

| Image | Built from | Tags |
|---|---|---|
| `darthjee/kerghan` | `dockerfiles/release_kerghan/Dockerfile` | `<v>`, `latest` |
| `darthjee/kerghan-standalone` | `dockerfiles/kerghan_standalone/Dockerfile`, target `standalone` | `<v>`, `latest` |
| `darthjee/kerghan-standalone` | same file, target `standalone-offline` | `<v>-offline`, `latest-offline` |

- All of them are multi-arch manifests (amd64 and arm64 under one tag), published to Docker Hub on
  every semver git tag.
- `<v>` is the app's git semver tag (for example `0.5.0`), not the `version` file, which only
  tracks the `*-base` images.
- `darthjee/kerghan-standalone:<v>` (both variants) always runs `darthjee/kerghan:<v>`.
- The client pins an exact version; `latest` and `latest-offline` exist for convenience only.

Pinned images:

| Image | Pin | Architectures |
|---|---|---|
| `darthjee/vault` (base) | `0.1.0` | multi-arch manifest |
| `mysql` (inner) | `9.3.0` | multi-arch manifest |
| `darthjee/tent` (inner) | `1.0.3` (amd64), `1.0.3-arm64` (arm64) | separate tags, selected per architecture |

Changing a pin is a normal change to the Dockerfile or the inner compose file. A Vault pin change
must also update `VAULT_VERSION` in `standalone/install.sh`.

The CI jobs that build and publish the images and the client assets (`release-kerghan`,
`release-kerghan-standalone`, `release-kerghan-assets`) are documented in
[architecture/infra.md](architecture/infra.md).

## Caveats

- **HTTPS.** The access-token cookie is always `Secure`. Browsers accept it on
  `http://localhost`, but not over plain HTTP on a LAN IP or a hostname, where login silently
  fails. Run standalone on `localhost`, or put your own TLS reverse proxy in front of it (and set
  `FRONTEND_BASE_URL` to the `https` URL in `kerghan.env`). An `https` `FRONTEND_BASE_URL` is also
  required to enable the GitHub OAuth App and GitHub App integration types.
- **Back up `~/.kerghan/kerghan.env`.** Losing it logs everyone out and makes the stored
  integration credentials unreadable (they are encrypted with `KERGHAN_INTEGRATIONS_KEY`). Without
  it, `kerghan up` refuses to start until the file is restored or the data is wiped with
  `kerghan reset`.
- **The MySQL password is fixed when the data volume is created.** Setting
  `KERGHAN_MYSQL_PASSWORD` later only applies to a fresh volume (after `kerghan reset`), unless you
  also change it inside MySQL.
- **Disk growth.** Older inner images accumulate in `vault-kerghan-data` after upgrades, and the
  offline variant stores image data twice. There is no automatic pruning; to clean up while the
  instance is running, remove the inner images no container uses:

  ```bash
  docker exec vault-kerghan docker image prune -a -f
  ```

  Unused images of the host Docker (for example older `darthjee/kerghan-standalone` tags) are
  cleaned up as usual with `docker image prune -a` on the host.
- **No downgrades.** Running an older image against a newer schema is unsupported; the client
  refuses it.
- **One instance per host.** The instance name `kerghan` is fixed.
- **Demo user.** The demo-seed migration also creates the `demo` user in standalone databases.
  `KERGHAN_DEMO_PASSWORD` is not passed to the stack, so its password falls back to a non-working
  placeholder. A future epic will handle the demo user in standalone.
- **Failed migration.** A migration that fails during an upgrade keeps the backend from starting;
  it shows up in `kerghan status` and `kerghan logs`. Recovery is to fix forward with the next
  release.

## Testing

| What | How |
|---|---|
| Build the online image locally | `make build-standalone` (tags `darthjee/kerghan-standalone:dev`) |
| Smoke-test it | `make standalone-smoke`, which runs `standalone/scripts/smoke_test.sh`: boots the image with `--privileged`, checks `/health.json` and `/` through Tent, restarts with the data volume kept, and checks no env file or secret is baked in. Needs `--privileged` support on the host Docker. |
| Client and installer tests | The bats suite in `standalone/test/` (with `helpers/` and command `stubs/`): `docker-compose run --rm standalone_tests`. CI runs it in the `standalone_tests` job. |

The release job smoke-tests the published offline image on amd64 with `SKIP_BUILD=true` and
`SMOKE_EXPECT_OFFLINE=true`, which also checks that the stack started from the preloaded tarballs
(see [architecture/infra.md](architecture/infra.md)). The arm64 image is checked by hand.
