# Baked image with offline preload

Back to the [Examples hub](../examples.md), which explains the placeholders and port mappings used below.

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

## Compose file

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

## Build

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
[base-image.md → Offline preload](../base-image.md#offline-preload) and
[base-image.md → Secrets](../base-image.md#secrets).

## With docker run

Nothing is mounted on `/vault`: the project is already in the image.

```bash
docker run --runtime=sysbox-runc \
  -v my-app-data:/var/lib/docker \
  -p 8080:80 \
  --env-file my-app.env \
  my-app
```

Without Sysbox, use `--privileged` instead of `--runtime=sysbox-runc`; see
[docker-run.md → Runtime](../docker-run.md#runtime) and [security.md](../security.md) first.

## With the CLI

```bash
vault up --image my-app --env-file my-app.env
```

Without a `[dir]`, nothing is mounted on `/vault` and the instance is named after the image;
see [cli.md → Baked images](../cli/guardrails.md#baked-images).

## Result

| | `docker run` | CLI |
|---|--------------|-----|
| App | `http://localhost:8080` | `http://localhost:3000` |
| Postgres | Not published; `app` reaches it as `db:5432`. | Same. |
| Data volume on `/var/lib/docker` | `my-app-data` | `vault-my-app-data` |
| Inner images | Loaded from `/vault/images/*.tar`, kept in the data volume. | Same. |
| Database data | Inner named volume `db-data`, kept inside the data volume. | Same. |
