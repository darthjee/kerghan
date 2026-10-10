# Concepts

How Vault works: Docker-in-Docker, `/vault`, ports, bind mounts, persistence and startup.
Back to the [Vault guides index](../vault.md).

## Docker-in-Docker

Vault runs its own Docker daemon. The image's entrypoint starts an inner `dockerd` inside the
Vault container, then runs `docker compose` against it. Every service of your stack is a
container of that inner daemon, not of the host's.

- The host only sees one container: Vault.
- The inner daemon needs elevated privileges: run Vault with the Sysbox runtime
  (recommended) or `--privileged`. See [security.md](security.md).
- The inner daemon listens on a unix socket only, never on TCP.

## `/vault`, the working directory

`docker compose` runs from `/vault`. Put your `docker-compose.yml` and every file it needs
there, either by mounting your project at `/vault` or by copying it into a derived image
(`COPY . /vault`).

Relative paths in the compose file (build contexts, env files, bind mounts) resolve against
`/vault`.

## Port flow

An inner service publishes its port **inside** the Vault container; you map that Vault port to
the host with `-p`.

| Hop | Example | Set by |
|-----|---------|--------|
| Host → Vault | host `8080` → Vault `80` | `docker run -p 8080:80` |
| Vault → inner service | Vault `80` → app `3000` | `ports: ["80:3000"]` in the compose file |

```yaml
# /vault/docker-compose.yml
services:
  app:
    image: my-app
    ports: ["80:3000"]   # inner port 3000 -> Vault port 80
  db:
    image: postgres:17   # no published ports
```

This example maps host port `8080` to Vault's port `80`:

```bash
docker run ... -p 8080:80 darthjee/vault:<version>   # host 8080 -> Vault 80 -> app 3000
```

The `vault` CLI maps host port `3000` to Vault's port `80` by default (`3000:80`); the flow
inside Vault is the same.

- The image declares `EXPOSE 80` as a convention only; any Vault port works if you map it.
- Databases and other internal services should not publish ports: services reach each other
  over the inner compose network.
- Vault has no built-in reverse proxy. To expose more than one service, publish each on its
  own Vault port and map each with its own `-p`.

## Bind mounts

Bind mounts in the inner compose file refer to the **Vault container's** filesystem, not the
host's.

- Anything the inner stack needs must first be mounted (or copied) into the Vault container,
  usually under `/vault`.
- A host path such as `/home/me/data` in the inner compose file points at a path inside the
  Vault container, which usually does not exist.
- Relative paths (`./config:/etc/app`) resolve against `/vault`.

```yaml
# /vault/docker-compose.yml
services:
  app:
    image: my-app
    volumes:
      - ./config:/etc/app   # /vault/config inside the Vault container
```

## Persistence

The image declares `VOLUME /var/lib/docker`: the inner daemon keeps everything there.

| Kept in `/var/lib/docker` | Effect |
|---------------------------|--------|
| Pulled and loaded images | No pull on the next start. |
| Inner named volumes (e.g. database data) | Data survives restarts. |

Mount a named volume there to keep both across restarts:

```bash
docker run ... -v vault-data:/var/lib/docker darthjee/vault:<version>
```

Without it, every start pulls the images again and inner data is lost with the container.
Using the data volume day to day (sharing, cleanup) is covered in
[operations.md → Persistence and the data volume](operations.md#persistence-and-the-data-volume). Never mount the same `/var/lib/docker`
volume into two running Vault containers.

## Startup sequence

1. **Pre-checks:** `VAULT_DOCKERD_TIMEOUT` must be a positive integer, and the container must
   have the privileges `dockerd` needs. Either failure exits `1` with a message.
2. **`dockerd`:** start the inner daemon and wait until it is ready, up to
   `VAULT_DOCKERD_TIMEOUT` seconds (default `30`).
3. **Offline preload:** `docker load` every `/vault/images/*.tar`; a missing `/vault/images`
   folder is skipped, a failing tarball exits `1`.
4. **`docker compose`:** with no arguments, `docker compose up` (plus `COMPOSE_UP_ARGS`); with
   arguments, `docker compose` with those arguments (e.g. `config`, `ps`, `up --build`).
5. **Exit:** when compose exits, stop `dockerd` and exit with compose's exit code. On SIGTERM /
   SIGINT, Vault runs `docker compose down` first, then stops `dockerd`.
