# Operations

How to run a Vault stack day to day: data, shutdown, logs, compose commands and failures.
Back to the [Vault guides index](../vault.md).

`docker run` examples use the `darthjee/vault:<version>` placeholder (replace `<version>` with
a published tag) and map host port `8080` to Vault's port `80` (`-p 8080:80`); CLI examples use
the CLI default `3000:80`. `<container>` is the Vault container's name or ID (`vault-<name>`
with the CLI).

## Persistence and the data volume

The inner daemon keeps its pulled and loaded images and the inner named volumes (e.g.
database data) in `/var/lib/docker`. Mount a named volume there:

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  -p 8080:80 \
  darthjee/vault:<version>
```

| | With the data volume | Without it |
|---|----------------------|------------|
| Images | Kept: no pull on the next start. | Pulled again on every start. |
| Inner named volumes (database data, ...) | Kept across restarts. | Lost with the container. |

The model is explained in [concepts.md → Persistence](concepts.md#persistence).

With the CLI, the data volume is `vault-<name>-data`. `vault down` never removes it, so data
survives `down` / `up`. To start from scratch, remove it by hand once the instance is down:

```bash
vault down
docker volume rm vault-<name>-data
```

See [cli.md → Instances](cli.md#instances).

## Never share the data volume

Never mount the same `/var/lib/docker` volume into two running Vault containers. Vault does
not detect it, and both inner daemons corrupt each other's state. Give each container its own
volume (`vault-a-data`, `vault-b-data`, ...).

With the CLI, two project directories with the same basename resolve to the same volume: pass
`--name` (or `name=` in `.vaultrc`) to tell them apart. See
[cli.md → Instances](cli.md#instances).

## Shutdown

On SIGTERM or SIGINT (`docker stop`, Ctrl+C, `vault down`), Vault:

1. runs `docker compose down` (if it fails, Vault prints `vault: docker compose down failed`
   and goes on);
2. stops the inner `dockerd`;
3. exits with compose's exit code.

A signal received before compose has started stops `dockerd` (if started) and exits with
`128 + signal` (`143` for SIGTERM, `130` for SIGINT).

### Stop timeouts

Docker waits 10 seconds by default after SIGTERM, then kills the container. Stopping a stack
and its daemon can take longer; a killed container skips the rest of the shutdown sequence.
Give it more time:

| Where | How |
|-------|-----|
| When starting | `docker run --stop-timeout 60 ...` |
| When stopping | `docker stop -t 60 <container>` |
| CLI | `--stop-timeout <seconds>` on `up`, `run`, `down`, or `stop-timeout=` in `.vaultrc`; default `60`. `vault down` runs `docker stop -t <stop-timeout>`. |

```bash
docker run --runtime=sysbox-runc --stop-timeout 60 \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  -p 8080:80 \
  darthjee/vault:<version>

docker stop -t 60 <container>
```

```bash
vault up --stop-timeout 90    # host 3000 -> Vault 80
vault down --stop-timeout 90
```

## Logs

The container's output is the inner daemon's and `docker compose`'s output, so the
service logs show up there:

```bash
docker logs <container>       # everything so far
docker logs -f <container>    # follow
```

```bash
vault logs                    # the instance of the current directory
vault logs -f                 # follow
```

`vault logs` fails when the instance is not running. For one service only, use compose (see
below): `docker compose logs -f app`.

## Compose commands on a running stack

Run `docker compose` inside the running Vault container. The container's working directory is
`/vault`, so compose finds the project, and the container's env (`COMPOSE_FILE`, ...) applies:

```bash
docker exec <container> docker compose ps
docker exec <container> docker compose logs -f app
docker exec -it <container> docker compose exec app sh
```

With the CLI:

```bash
vault compose ps
vault compose logs -f app
vault compose exec app sh
```

`vault compose` fails when the instance is not running; it exits with the inner command's exit
code. See [cli.md → Commands](cli.md#commands).

Do not start a second container (`docker run ... ps`, `vault run`) on the data volume of a
running one: see [Never share the data volume](#never-share-the-data-volume). The CLI refuses
`vault run` while the instance is running.

## Service failures

- The Vault container only exits when `docker compose` exits. A crashing service alone does
  not stop it.
- Individual service crashes are handled by compose `restart:` policies:

  ```yaml
  # /vault/docker-compose.yml
  services:
    app:
      image: my-app
      restart: unless-stopped
      ports: ["80:3000"]
  ```

- To fail fast instead (the whole container stops when any service exits), set
  `COMPOSE_UP_ARGS="--abort-on-container-exit"`:

  ```bash
  docker run --runtime=sysbox-runc \
    -v "$PWD/my-stack:/vault" \
    -v vault-data:/var/lib/docker \
    -p 8080:80 \
    -e COMPOSE_UP_ARGS="--abort-on-container-exit" \
    darthjee/vault:<version>
  ```

  ```bash
  vault up -e COMPOSE_UP_ARGS="--abort-on-container-exit"
  ```

The container then exits with compose's exit code; see [troubleshooting.md → Exit codes](troubleshooting.md#exit-codes) for exit codes and
[configuration.md → `COMPOSE_UP_ARGS`](configuration.md#compose_up_args) for the variable.
