# Running the image with docker run

How to run your compose project with the published image directly, without the `vault` CLI.
Back to the [Vault guides index](../vault.md).

Every example on this page maps host port `8080` to Vault's port `80` (`-p 8080:80`) and uses
the `darthjee/vault:<version>` placeholder: replace `<version>` with a published tag.

## Runtime

The inner Docker daemon needs elevated privileges. Pick one runtime:

| Runtime | Flag | Status |
|---------|------|--------|
| Sysbox | `--runtime=sysbox-runc` | Recommended; Sysbox must be installed on the host. |
| Privileged | `--privileged` | Fallback; read [security.md](security.md) before using it. |

Recommended, with the [Sysbox](https://github.com/nestybox/sysbox) runtime:

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  -p 8080:80 \
  darthjee/vault:<version>
```

Fallback, with `--privileged`:

```bash
docker run --privileged \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  -p 8080:80 \
  darthjee/vault:<version>
```

Without either, Vault exits `1` with
`dockerd failed to start; are you running with --privileged (or the sysbox runtime)?`.

## Mounting the project

Mount the directory holding your `docker-compose.yml` on `/vault`:

```bash
-v "$PWD/my-stack:/vault"
```

`docker compose` runs from `/vault`, so relative paths in the compose file (build contexts,
env files, bind mounts) resolve against it. Bind mounts in the inner compose file refer to the
Vault container's filesystem, not the host's: see [concepts.md](concepts.md#vault-the-working-directory)
and [concepts.md → Bind mounts](concepts.md#bind-mounts).

## The data volume

Mount a named volume on `/var/lib/docker`:

```bash
-v vault-data:/var/lib/docker
```

It keeps the inner daemon's pulled and loaded images and the inner named volumes (e.g.
database data) across restarts. Without it, every start pulls the images again and inner data
is lost with the container. See [concepts.md → Persistence](concepts.md#persistence).

Never mount the same volume into two running Vault containers: both inner daemons would
corrupt each other's state. Give each container its own volume.

## Ports

This page uses `-p 8080:80`: host `8080` → Vault `80` → the inner service that publishes
Vault port `80` in the compose file (e.g. `ports: ["80:3000"]`).

```bash
-p 8080:80   # host 8080 -> Vault 80 -> app 3000
```

To expose another inner service, publish it on its own Vault port and add one more `-p`. See
[concepts.md → Port flow](concepts.md#port-flow).

## Environment variables

Pass variables with `-e KEY=value`, or a whole file with `--env-file <file>`:

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  -p 8080:80 \
  -e COMPOSE_UP_ARGS="--abort-on-container-exit" \
  --env-file my-stack.env \
  darthjee/vault:<version>
```

- The full list of variables (`COMPOSE_FILE`, `COMPOSE_UP_ARGS`, `VAULT_DOCKERD_TIMEOUT`, ...)
  lives in [configuration.md](configuration.md#environment-variables).
- Keep env files that hold secrets out of git. See [security.md → Secrets](security.md#secrets).

## Compose arguments

The container's arguments go to `docker compose`:

| Arguments | Runs |
|-----------|------|
| none | `docker compose up ${COMPOSE_UP_ARGS}` |
| any | `docker compose "$@"`, with exactly those arguments |

```bash
# Print the resolved compose file
docker run --runtime=sysbox-runc \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  darthjee/vault:<version> config

# List the stack's services
docker run --runtime=sysbox-runc \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  darthjee/vault:<version> ps

# Rebuild the images, then start the stack
docker run --runtime=sysbox-runc \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  -p 8080:80 \
  darthjee/vault:<version> up --build
```

`COMPOSE_UP_ARGS` only applies when no arguments are given. Either way, the container exits
with compose's exit code.

## Stopping

On `docker stop` (SIGTERM) or Ctrl+C (SIGINT), Vault runs `docker compose down`, then stops
the inner daemon. That can take longer than `docker stop`'s default 10 seconds, after which
Docker kills the container. Give it more time, either when starting:

```bash
docker run --runtime=sysbox-runc --stop-timeout 60 \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  -p 8080:80 \
  darthjee/vault:<version>
```

or when stopping:

```bash
docker stop -t 60 <container>
```

The full shutdown sequence lives in [operations.md → Shutdown](operations.md#shutdown).

## The CLI alternative

The `vault` CLI wraps these flags: named instances, runtime auto-detection (Sysbox, else
`--privileged`), `.vaultrc` and guardrails. See [cli.md](cli.md).
