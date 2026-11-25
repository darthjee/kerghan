# Standalone: inner stack

Part of [Standalone Distribution](../standalone.md). What runs inside the standalone container: MySQL, Tent, the frontend, image variants, origin and client IP handling.

## Inner stack

Vault starts its own Docker daemon, loads any image tarballs from `/vault/images/`, then runs
`docker compose up` from `/vault`. Bind mounts in the inner compose file resolve against the Vault
container's filesystem. Inner images and volumes live in Vault's `/var/lib/docker`, which is the
`vault-kerghan-data` volume when the client runs it. See the [Vault guide](../external/vault.md).

The inner compose file is `standalone/vault/docker-compose.yml`, copied to `/vault`:

| Service | Image | Notes |
|---|---|---|
| `mysql` | `mysql:8.4.11` | Internal only, never published. Healthcheck (`mysqladmin ping`). Data in the inner `mysql84-data` volume. |
| `mysql-legacy` | `mysql:9.3.0` | Profile `migrate-mysql-9`: never started by `compose up`. Only used to migrate pre-#469 data from the old `mysql-data` volume (see [MySQL 9.3 to 8.4.11 migration](#mysql-93-to-8411-migration)). No restart policy. Removed in a later release. |
| `kerghan` | `darthjee/kerghan:${KERGHAN_VERSION}` | Runs migrations on boot. Waits for `mysql` to be healthy. Receives only the allowlisted environment (see [environment-variables/standalone.md](../environment-variables/standalone.md)). |
| `tent` | `${TENT_IMAGE}` (stock `darthjee/tent`) | Published on Vault port 80. Serves the frontend and proxies `*.json` to `http://kerghan:3000/`. |

| `logs` | `${LOGS_IMAGE}` (`docker:27.5.1-cli`) | The log collector (see [Log files](#log-files)). `init: true`, `restart: unless-stopped`, mounts the inner Docker socket (it is the only service that does), `./logs` at `/logs` and `./logs-collector` at `/collector` (read-only). Env: `KERGHAN_FILE_LOGS`, `KERGHAN_HOST_UID`, `KERGHAN_HOST_GID`. Nothing depends on it. |

`mysql`, `kerghan`, `tent` and `logs` use `restart: unless-stopped`. With the healthcheck and `depends_on`, a backend started
before MySQL is ready retries instead of leaving the stack dead.

Every service logs with the `json-file` driver capped at `max-size: 10m`, `max-file: 5` (the
`x-logging` anchor), so Docker's own copy of a service's output cannot fill the inner volume.

### Log files

`logs` follows the `tent` (Apache access and error output) and `kerghan` (backend and workers)
containers with `docker logs -f -t` and writes `tent.log` and `kerghan.log` to `/vault/logs`, which
the client mounts from the host `log-dir` (default `~/.kerghan/logs`). MySQL is not collected.
`standalone/vault/logs-collector/collect.sh` (POSIX `sh`) does the work:

- With `KERGHAN_FILE_LOGS` not `true` it idles, so `restart: unless-stopped` does not loop.
- It runs with `umask 077` and never changes the owner or mode of `/logs` itself (the client
  creates the directory and sets `700` only when it created it); every log file is created with
  mode `600` and `chown`ed to `KERGHAN_HOST_UID:KERGHAN_HOST_GID`, as are the `.since` files.
  Failures are logged to stderr and the script keeps going.
- Each line has Docker's RFC 3339 timestamp. A file rotates at 10 MB, keeping `.log.1` to `.log.5`.
- It finds each container by the Compose service and project labels (the project comes from its
  own container labels). When a container stops or is recreated it sleeps 2 s and resolves it again,
  resuming with `--since` the last timestamp saved in `/logs/.<svc>.since`, so a restart does not
  duplicate lines. The `.since` file is only written when the line's first field is an RFC 3339
  timestamp, and is read back only if it still matches that pattern, passed as `--since=<value>`. If a follower dies the script exits and compose restarts the service.
- The files are appended to, so they survive `kerghan down`, `reset` and restarts.

`LOGS_IMAGE` is written to `/vault/.env` by the Dockerfile next to `TENT_IMAGE`. The outer Vault
container's own log is not bounded (darthjee/vault#81).

### MySQL 9.3 to 8.4.11 migration

Releases before #469 ran MySQL 9.3.0 (inner volume `mysql-data`); the stack now runs 8.4.11, the
production version, on a new volume `mysql84-data`. A 9.x data directory cannot be opened by 8.4,
so the data is dumped and restored.

**When it runs:** `kerghan up` (including the already-running path, and `kerghan update` when it
restarts the instance, because that runs `up`) looks for an old inner volume that holds a MySQL data
directory (`ibdata1` or `mysql.ibd`). Fresh installs have none and skip it, and never pull 9.3.0.

**Steps:**

1. Stop `kerghan` (the backend ran its migrations once on the empty 8.4 database; whatever it wrote
   there is replaced).
2. Start `mysql-legacy` (profile `migrate-mysql-9`) and wait, bounded, for it to be healthy.
3. Record per-table row counts (all base tables except `migrations`).
4. `DROP DATABASE kerghan; CREATE DATABASE kerghan` in `mysql`, then stream
   `mysqldump --single-transaction --routines --triggers --databases kerghan` from `mysql-legacy`
   into `mysql`. The dump is a pipe between two `compose exec` calls: it is never a file and never
   reaches the host. Passwords come from each container's own `MYSQL_ROOT_PASSWORD`, never a
   command line.
5. Remove `mysql-legacy`, start `kerghan`, wait for the backend to answer, and compare row counts.
6. Only when everything matches, remove the old volume and print
   `MySQL data migrated from 9.3 to 8.4.11; the old 9.3 data was removed`.

**Failure and retry:** any failure stops `mysql-legacy`, keeps the old volume, prints an `error` and
a `hint` and exits 1. `kerghan up` again retries from scratch (the restore drops and recreates the
database). `KERGHAN_MIGRATE_TIMEOUT` (seconds, default 300) bounds each wait.

**Downgrade:** going back to a release before this one is unsupported once the migration succeeded:
the old volume is gone and the old compose would start 9.3 on a missing volume, an empty database.

**Manual procedure** (running the image without the client; `<vault>` is the container, usually
`vault-kerghan`, and the inner compose project name may differ from `vault`):

```
docker exec -w /vault <vault> docker compose stop kerghan
docker exec -w /vault <vault> docker compose --profile migrate-mysql-9 up -d mysql-legacy
# wait until both are healthy
docker exec -w /vault <vault> docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "DROP DATABASE IF EXISTS kerghan; CREATE DATABASE kerghan"'
docker exec -w /vault <vault> docker compose exec -T mysql-legacy sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --databases kerghan' \
  | docker exec -i -w /vault <vault> docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
docker exec -w /vault <vault> docker compose --profile migrate-mysql-9 rm -s -f mysql-legacy
docker exec -w /vault <vault> docker compose start kerghan
# check the app and the data, then delete the old volume
docker exec <vault> docker volume rm <project>_mysql-data
```

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

- **`frontend`** stage: `FROM --platform=$BUILDPLATFORM darthjee/vite_kerghan-base:0.1.2`, runs
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
  `darthjee/kerghan:<v>`, `mysql:8.4.11`, the Tent image and `docker:27.5.1-cli` (the log collector). `mysql:9.3.0` is pulled only when a
  migration needs it.
- **Offline** (`darthjee/kerghan-standalone:<v>-offline`): the inner images are preloaded as
  tarballs (`kerghan.tar`, `mysql.tar`, `tent.tar`, `docker-cli.tar`, plus `mysql-legacy.tar` (`mysql:9.3.0`) for the #469
  migration release only, one set per architecture, written by
  `bin/release_kerghan_standalone.sh` with `docker save`; each tarball is single-architecture, as the
  images are pulled by digest). Vault runs `docker load` on every
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

### Effective client IP

Automatic login depends on the client IP the backend sees. The path of a host request is: host,
port published by the outer Docker daemon, the Vault container, port published by the inner
Docker daemon, Tent, backend. Tent's `SetClientIpMiddleware` overwrites `X-Forwarded-For` with its
own `REMOTE_ADDR` (one entry), and the backend reads it with `KERGHAN_TRUSTED_PROXY_HOPS` at its
default of `1`, so the backend sees exactly the address Tent's socket sees. That is why
`KERGHAN_TRUSTED_PROXY_HOPS` is not passed to the stack.

Measured by #371 (2026-10-14, Docker Desktop for macOS, arm64) with `darthjee/vault:0.1.0`
running a probe inner service published like Tent (`ports: ["80:80"]`):

| Outer publish | Request from | Address seen by the inner service |
|---|---|---|
| `127.0.0.1:<port>:80` (default bind) | host, `127.0.0.1` | `172.17.0.1`, the outer daemon's bridge gateway |
| `0.0.0.0:<port>:80` | host, `127.0.0.1` or its LAN address | `172.64.155.209`, a non-private address |

- The inner daemon forwards with iptables DNAT, so it keeps the source address the outer daemon
  hands to the Vault container. The effective IP therefore depends on the outer host's Docker
  networking, not on the image.
- With the default bind, the effective IP is inside `172.16.0.0/12`, so a fresh installation logs
  in automatically from the host.
- With `bind=0.0.0.0` on that host, every request (even from the host itself) arrived from
  `172.64.155.209`, outside the allowlist, so automatic login would not happen there. The cause
  was not confirmed (Docker Desktop's port forwarder for all-interface binds, or something on that
  machine).
- With `127.0.0.1` published, the host's LAN address could not reach the port (connection
  refused).

The allowlist stays the full private-range list rather than `172.17.0.1`: only one host type was
measured, and the outer gateway changes with the Docker setup (a Linux daemon with a custom `bip`
or `default-address-pools`, other Docker Desktop settings). The items not verified yet are listed
under [Caveats](release-and-caveats.md#caveats).

### Verifying the effective client IP

`standalone/scripts/verify_client_ip.sh` runs the checks still open in #384. Run it from the repo
root; it only uses `docker` and `curl` (plus the installed `kerghan` client for the end-to-end
check) and never installs anything. Each run prints one block between
`----- BEGIN kerghan client-IP report (#384) -----` and `----- END ... -----` on stdout, with the
platform (`uname -sm`), Docker Engine version, Docker Desktop or native, runtime, bind and date.
Paste the whole block into the issue or PR. The header comment of the script lists every input.

| Mode | What it does |
|---|---|
| `probe` (default) | Repeats the #371 measurement: starts `darthjee/vault:0.1.0` (`VAULT_IMAGE`) with a probe inner service (`traefik/whoami`, `standalone/scripts/verify_client_ip/docker-compose.yml`) published like Tent (`ports: ["80:80"]`), with the outer container on `BIND:PORT:80` (`BIND` defaults to `127.0.0.1`, `PORT` to `3090`). Requests it from the host (from `127.0.0.1`, plus each non-loopback address when `BIND=0.0.0.0`) and reports the address the probe saw and whether it is inside the allowlist (`DEFAULT_USER_ALLOWED_IPS`, read from `standalone/bin/kerghan`). |
| `reach` | Starts the same probe on `127.0.0.1:PORT`, tries each non-loopback address of the host (`ip -o addr` on Linux, `ifconfig` on macOS), and prints the commands a second LAN machine runs: the host port, and the moby#45610 route to the Vault container's address. |
| `e2e` | No container management. POSTs `/auth/status.json` on `BASE_URL` (default `http://localhost:<port>`, the port from `~/.kerghan/config`, else `3000`) without cookies, and reports `loggedIn`, the user (from the `access_token` cookie), `isAdmin`, and the image, published address, runtime, auto-login variables and `KERGHAN_COOKIE_SECURE` of the `vault-kerghan` container. Exits 1 unless the answer matches `EXPECT_LOGGED_IN` (default `true`) and `EXPECT_USER` (default `admin`). |

- `RUNTIME=auto|sysbox|privileged` picks the runtime (`auto`, the default, uses Sysbox when the
  daemon has `sysbox-runc`); `RUNTIME=sysbox` fails when Sysbox is missing.
- `HOLD=true` keeps the probe up after the report, until Ctrl-C, so a LAN machine can run its
  command. `LAN_IP` overrides the host LAN address used in those commands.
- `probe` and `reach` always remove their container and data volume, also on failure or Ctrl-C.

Checks (one report per run; record each result in [Effective client IP](#effective-client-ip)):

1. **Linux, native Docker, Sysbox.**
   `RUNTIME=sysbox BIND=127.0.0.1 standalone/scripts/verify_client_ip.sh probe`, then
   `RUNTIME=sysbox BIND=0.0.0.0 standalone/scripts/verify_client_ip.sh probe`. Pass: every seen
   address is inside the allowlist.
2. **Linux, native Docker, `--privileged`.** Same as 1 with `RUNTIME=privileged`.
3. **Linux, `bind=0.0.0.0`, from the LAN.**
   `BIND=0.0.0.0 HOLD=true standalone/scripts/verify_client_ip.sh probe`, then on a second LAN
   machine the printed `curl ... | grep RemoteAddr` command. Pass: the `RemoteAddr` the LAN machine
   gets is its own private address, inside the allowlist.
4. **Linux, Docker Engine 28+, default bind not reachable from other interfaces.**
   `HOLD=true standalone/scripts/verify_client_ip.sh reach`, then on a second LAN machine both
   printed commands (the moby#45610 one needs a Linux LAN machine on the same segment and root).
   Pass: every non-loopback address is `not reachable`, and neither LAN command gets an answer.
5. **End to end.** With the first released `kerghan-standalone` tag that includes #368–#372 (not
   a locally built image): `kerghan up` with the default settings (no `~/.kerghan/config` changes,
   a `kerghan.env` with the default-user values), then
   `standalone/scripts/verify_client_ip.sh e2e`, and open the URL in the host browser. Pass: the
   report says `result: PASS` (`loggedIn: true`, `user: admin`, `isAdmin: true`) with the released
   tag as `instance image`, and the browser shows Kerghan logged in as `admin` with no login step.
6. **Docker Desktop for macOS, `bind=0.0.0.0`.**
   `BIND=0.0.0.0 standalone/scripts/verify_client_ip.sh probe`, repeated with the Docker Desktop
   network settings varied where relevant (for example the networking mode or the host networking
   toggle, with any VPN or proxy turned off). Record whether `172.64.155.209` (or another
   non-private address) reproduces, and which change, if any, makes it go away.

If a result shows that `KERGHAN_DEFAULT_USER_ALLOWED_IPS`, `KERGHAN_TRUSTED_PROXY_HOPS` or the
default `bind` is wrong, open a separate issue and link it from here; the verification does not
change behavior.

