# Using Vault as a base image

How to ship your compose stack as its own image, built on Vault.
Back to the [Vault guides index](../vault.md).

The examples use the `darthjee/vault:<version>` placeholder (replace `<version>` with a
published tag) and map host port `8080` to Vault's port `80` (`-p 8080:80`).

## Dockerfile

Copy your compose project into `/vault`, where `docker compose` runs:

```dockerfile
FROM darthjee/vault:<version>
COPY . /vault
```

The build context is your compose project: `docker-compose.yml` and every file it needs.
Relative paths in the compose file resolve against `/vault`; see
[concepts.md](concepts.md#vault-the-working-directory).

Add a `.dockerignore` so env files, secrets and other local files are not copied:

```text
.git
.env
*.env
.vault.env
```

## Offline preload

Before compose starts, Vault runs `docker load` on every `/vault/images/*.tar`, so the stack
can start without pulling:

1. Save each image the stack needs into an `images/` folder of the project:

   ```bash
   mkdir -p images
   docker save -o images/my-app.tar my-app:1.0
   docker save -o images/postgres.tar postgres:17
   ```

2. `COPY . /vault` puts them in `/vault/images/`.

- Tarballs are loaded in name order. A missing `/vault/images` folder (or one without
  `*.tar` files) is skipped.
- A tarball that fails to load stops the container with exit code `1` and
  `failed to load image tarball: <file>`.
- Save images for the platform the derived image runs on (`linux/amd64` or `linux/arm64`).

Preloading does not stop compose from pulling. To prevent pulls entirely, either set
`COMPOSE_UP_ARGS` in the Dockerfile (or at run time with `-e`):

```dockerfile
FROM darthjee/vault:<version>
COPY . /vault
ENV COMPOSE_UP_ARGS="--pull never"
```

or set `pull_policy:` per service in the compose file:

```yaml
# /vault/docker-compose.yml
services:
  app:
    image: my-app:1.0
    pull_policy: never
    ports: ["80:3000"]
```

`COMPOSE_UP_ARGS` only applies to the default `docker compose up` (no container arguments).

## Running the baked image

Build it:

```bash
docker build -t my-app .
```

### With docker run

Nothing is mounted on `/vault`: the project is already in the image. This page uses
`-p 8080:80`. Recommended, with the Sysbox runtime:

```bash
docker run --runtime=sysbox-runc \
  -v my-app-data:/var/lib/docker \
  -p 8080:80 \
  my-app
```

Fallback, with `--privileged` (read [security.md](security.md) first):

```bash
docker run --privileged \
  -v my-app-data:/var/lib/docker \
  -p 8080:80 \
  my-app
```

The flags work as with the published image; see [docker-run.md](docker-run.md) for the
runtime, the data volume, ports, env vars, compose arguments and stopping.

### With the CLI

```bash
vault up --image my-app -p 8080:80
```

Without a `[dir]`, nothing is mounted on `/vault` and the instance is named after the image
(`vault-my-app`). Details in [cli.md → Baked images](cli.md#baked-images).

## Secrets

Never bake secrets into the derived image: anyone who can pull the image can read every file
and `ENV` value in it. Keep them out of the build context (see `.dockerignore` above) and pass
them at run time:

```bash
docker run --runtime=sysbox-runc \
  -v my-app-data:/var/lib/docker \
  -p 8080:80 \
  --env-file my-app.env \
  my-app
```

Secrets handling is detailed in [configuration.md → Secrets handling](configuration.md#secrets-handling); see also
[security.md → Secrets](security.md#secrets).
