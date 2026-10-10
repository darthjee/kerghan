# Examples

Complete setups you can copy whole. Back to the [Vault guides index](../vault.md).

Each setup has a `docker run` variant and a CLI variant:

| Variant | Port mapping | Host URL |
|---------|--------------|----------|
| `docker run` | `-p 8080:80` (host `8080` → Vault `80`) | `http://localhost:8080` |
| `vault` CLI | default `3000:80` (host `3000` → Vault `80`), unless `-p` is given | `http://localhost:3000` |

- `my-app` is a placeholder for your own application image; it listens on port `3000`.
- `darthjee/vault:<version>` is a placeholder: replace `<version>` with a published tag.
- The model behind these setups (`/vault`, port flow, bind mounts, persistence) is explained
  in [concepts.md](concepts.md).
- Stopping, logs and compose commands on a running stack are in
  [operations.md](operations.md); errors and exit codes in
  [troubleshooting.md](troubleshooting.md).

## App + Postgres

```
app-postgres/
├── docker-compose.yml
├── .vault.env        # POSTGRES_PASSWORD=...; never committed
└── .gitignore        # contains .vault.env
```

### Compose file

```yaml
# /vault/docker-compose.yml
services:
  app:
    image: my-app
    ports: ["80:3000"]   # inner port 3000 -> Vault port 80
    depends_on: [db]
    environment:
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
  db:
    image: postgres:17   # no published ports
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

The password lives in `.vault.env`, passed to the Vault container as an env file, so
`docker compose` reads `POSTGRES_PASSWORD` from its environment. Keep that file out of git;
see [configuration.md → Secrets handling](configuration.md#secrets-handling).

```
# .vault.env
POSTGRES_PASSWORD=change-me
```

### With docker run

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/app-postgres:/vault" \
  -v app-postgres-data:/var/lib/docker \
  -p 8080:80 \
  --env-file app-postgres/.vault.env \
  darthjee/vault:<version>
```

Without Sysbox, use `--privileged` instead of `--runtime=sysbox-runc`; see
[docker-run.md → Runtime](docker-run.md#runtime) and [security.md](security.md) first.

### With the CLI

```bash
vault up ./app-postgres
```

The CLI picks the runtime (Sysbox, else `--privileged`) and passes `.vault.env` as an env file
by itself; see [cli.md → `.vault.env`](cli.md#vaultenv).

### Result

| | `docker run` | CLI |
|---|--------------|-----|
| App | `http://localhost:8080` | `http://localhost:3000` |
| Postgres | Not published; `app` reaches it as `db:5432`. | Same. |
| Data volume on `/var/lib/docker` | `app-postgres-data` | `vault-app-postgres-data` |
| Database data | Inner named volume `db-data`, kept inside the data volume. | Same. |

## App + Redis

```
app-redis/
└── docker-compose.yml
```

### Compose file

```yaml
# /vault/docker-compose.yml
services:
  app:
    image: my-app
    ports: ["80:3000"]   # inner port 3000 -> Vault port 80
    depends_on: [redis]
    environment:
      REDIS_URL: redis://redis:6379
  redis:
    image: redis:7       # no published ports
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

### With docker run

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/app-redis:/vault" \
  -v app-redis-data:/var/lib/docker \
  -p 8080:80 \
  darthjee/vault:<version>
```

Without Sysbox, use `--privileged` instead of `--runtime=sysbox-runc`; see
[docker-run.md → Runtime](docker-run.md#runtime) and [security.md](security.md) first.

### With the CLI

```bash
vault up ./app-redis
```

### Result

| | `docker run` | CLI |
|---|--------------|-----|
| App | `http://localhost:8080` | `http://localhost:3000` |
| Redis | Not published; `app` reaches it as `redis:6379`. | Same. |
| Data volume on `/var/lib/docker` | `app-redis-data` | `vault-app-redis-data` |
| Redis data | Inner named volume `redis-data`, kept inside the data volume. | Same. |

## Multiple compose files

```
app-multi/
├── compose.yml
└── compose.prod.yml
```

### Compose files

```yaml
# /vault/compose.yml
services:
  app:
    image: my-app
    ports: ["80:3000"]   # inner port 3000 -> Vault port 80
    environment:
      APP_ENV: development
```

```yaml
# /vault/compose.prod.yml
services:
  app:
    image: my-app:1.0    # pin the image for production
    environment:
      APP_ENV: production
```

`COMPOSE_FILE=compose.yml:compose.prod.yml` merges both files in order, the later one
overriding the earlier one. Paths are relative to `/vault`; see
[configuration.md → Multiple compose files](configuration.md#multiple-compose-files).

### With docker run

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/app-multi:/vault" \
  -v app-multi-data:/var/lib/docker \
  -p 8080:80 \
  -e COMPOSE_FILE=compose.yml:compose.prod.yml \
  darthjee/vault:<version>
```

Without Sysbox, use `--privileged` instead of `--runtime=sysbox-runc`; see
[docker-run.md → Runtime](docker-run.md#runtime) and [security.md](security.md) first.

### With the CLI

```bash
vault up -e COMPOSE_FILE=compose.yml:compose.prod.yml ./app-multi
```

To avoid repeating it, put `env=COMPOSE_FILE=compose.yml:compose.prod.yml` in the project's
`.vaultrc`; see [cli.md → `.vaultrc`](cli.md#vaultrc).

### Result

| | `docker run` | CLI |
|---|--------------|-----|
| App | `http://localhost:8080`, running `my-app:1.0` with `APP_ENV=production` | `http://localhost:3000`, same |
| Data volume on `/var/lib/docker` | `app-multi-data` | `vault-app-multi-data` |

Leave `COMPOSE_FILE` out to run `compose.yml` alone.

## Baked image with offline preload

The stack ships as one image, `my-app`, built on Vault, with its inner images preloaded so it
starts without pulling.

```
app-baked/
├── Dockerfile
├── .dockerignore     # .git, .env, *.env, .vault.env
├── docker-compose.yml
└── images/
    ├── my-app.tar
    └── postgres.tar
```

### Compose file

```yaml
# /vault/docker-compose.yml
services:
  app:
    image: my-app:1.0
    ports: ["80:3000"]   # inner port 3000 -> Vault port 80
    depends_on: [db]
    environment:
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
  db:
    image: postgres:17   # no published ports
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

The inner app image is tagged `my-app:1.0` so that building the baked image as `my-app`
does not overwrite it locally.

### Build

Save the inner images into `images/`, for the platform the baked image runs on
(`linux/amd64` or `linux/arm64`):

```bash
cd app-baked
mkdir -p images
docker save -o images/my-app.tar my-app:1.0
docker save -o images/postgres.tar postgres:17
```

```dockerfile
FROM darthjee/vault:<version>
COPY . /vault
ENV COMPOSE_UP_ARGS="--pull never"
```

```bash
docker build -t my-app .
```

On startup Vault `docker load`s every `/vault/images/*.tar`; `--pull never` stops compose from
pulling. No secret goes into the image: `POSTGRES_PASSWORD` comes at run time from an env file
kept out of git and out of the build context (e.g. `my-app.env`, outside `app-baked/`). See
[base-image.md → Offline preload](base-image.md#offline-preload) and
[base-image.md → Secrets](base-image.md#secrets).

### With docker run

Nothing is mounted on `/vault`: the project is already in the image.

```bash
docker run --runtime=sysbox-runc \
  -v my-app-data:/var/lib/docker \
  -p 8080:80 \
  --env-file my-app.env \
  my-app
```

Without Sysbox, use `--privileged` instead of `--runtime=sysbox-runc`; see
[docker-run.md → Runtime](docker-run.md#runtime) and [security.md](security.md) first.

### With the CLI

```bash
vault up --image my-app --env-file my-app.env
```

Without a `[dir]`, nothing is mounted on `/vault` and the instance is named after the image;
see [cli.md → Baked images](cli.md#baked-images).

### Result

| | `docker run` | CLI |
|---|--------------|-----|
| App | `http://localhost:8080` | `http://localhost:3000` |
| Postgres | Not published; `app` reaches it as `db:5432`. | Same. |
| Data volume on `/var/lib/docker` | `my-app-data` | `vault-my-app-data` |
| Inner images | Loaded from `/vault/images/*.tar`, kept in the data volume. | Same. |
| Database data | Inner named volume `db-data`, kept inside the data volume. | Same. |
