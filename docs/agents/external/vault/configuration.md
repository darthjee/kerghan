# Configuration

How to configure a Vault stack with environment variables, and how to keep its secrets safe.
Back to the [Vault guides index](../vault.md).

Examples use the `darthjee/vault:<version>` placeholder (replace `<version>` with a published
tag). `docker run` examples map host port `8080` to Vault's port `80` (`-p 8080:80`); CLI
examples use the CLI default `3000:80` unless they pass `-p`.

## Environment variables

The image reads these variables at startup:

| Variable | Default | Purpose |
|----------|---------|---------|
| `COMPOSE_FILE` | compose default | Compose file(s) to use; a `:`-separated list is allowed (see [Multiple compose files](#multiple-compose-files)). |
| `COMPOSE_PROJECT_NAME` | compose default | Compose project name. |
| `COMPOSE_UP_ARGS` | empty | Extra arguments for the default `docker compose up`, e.g. `--abort-on-container-exit` or `--pull never`. |
| `VAULT_DOCKERD_TIMEOUT` | `30` | Seconds to wait for the inner `dockerd` to start. Must be a positive integer. |

Any other `COMPOSE_*` variable understood by `docker compose` is passed through and works as
usual.

### `COMPOSE_UP_ARGS`

- Only used when the container gets **no arguments** (the default `docker compose up`). With
  arguments, Vault runs `docker compose` with exactly those arguments and ignores it.
- Split on whitespace, with **no quoting support**: quotes are passed to compose as part of
  the words, and an argument cannot contain a space.

| Value | Runs |
|-------|------|
| empty (default) | `docker compose up` |
| `--abort-on-container-exit` | `docker compose up --abort-on-container-exit` (fail fast, see [operations.md → Service failures](operations.md#service-failures)) |
| `--pull never` | `docker compose up --pull never` (no pulls, see [base-image.md → Offline preload](base-image.md#offline-preload)) |
| `--pull never --abort-on-container-exit` | both |

### `VAULT_DOCKERD_TIMEOUT`

- Vault polls the inner daemon once per second, up to this many times, before giving up.
- Unset or empty, it defaults to `30`. Raise it on slow hosts where `dockerd` takes longer
  than 30 seconds to start.
- It must be a positive integer (`1`, `30`, `120`). Anything else (`0`, `-5`, `30s`)
  stops the container at startup with exit code `1` and
  `VAULT_DOCKERD_TIMEOUT must be a positive integer, got: '<value>'`. See
  [troubleshooting.md → Startup errors](troubleshooting.md#startup-errors) for every startup error.

## Multiple compose files

Set `COMPOSE_FILE` to a `:`-separated list; compose merges the files in order, later files
overriding earlier ones:

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  -p 8080:80 \
  -e COMPOSE_FILE=compose.yml:compose.prod.yml \
  darthjee/vault:<version>
```

Paths are relative to `/vault`, where `docker compose` runs (see
[concepts.md](concepts.md#vault-the-working-directory)). Every file in the list must be in the
mounted project (or copied into a derived image).

## Passing variables

### With `docker run`

Pass variables one by one with `-e KEY=value`, or a whole file with `--env-file <file>`. This
example maps host `8080` to Vault `80`:

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/my-stack:/vault" \
  -v vault-data:/var/lib/docker \
  -p 8080:80 \
  -e COMPOSE_UP_ARGS="--abort-on-container-exit" \
  --env-file my-stack.env \
  darthjee/vault:<version>
```

An env file holds one `KEY=value` per line:

```
# my-stack.env
COMPOSE_FILE=compose.yml:compose.prod.yml
VAULT_DOCKERD_TIMEOUT=60
DATABASE_PASSWORD=change-me
```

See [docker-run.md → Environment variables](docker-run.md#environment-variables).

### With the CLI

The `vault` CLI passes variables to the Vault container without interpreting them:

- `-e KEY=VALUE` and `--env-file <file>` on `vault up` / `vault run`;
- `env=` and `env-file=` lines in `.vaultrc`;
- a `.vault.env` file in the project directory, passed as the first env file.

```bash
vault up -e COMPOSE_UP_ARGS="--abort-on-container-exit"   # host 3000 -> Vault 80
```

Which source wins is described in [cli.md → Precedence](cli.md#precedence); `.vault.env` in
[cli.md → `.vault.env`](cli.md#vaultenv).

## Secrets handling

### Keep env files out of git

`.vault.env` and the env files you pass with `--env-file` usually hold secrets. Never commit
them; add them to the project's `.gitignore`:

```gitignore
.vault.env
.env
*.env
```

Commit a template with placeholder values instead (e.g. `my-stack.env.example`), and let each
developer or deploy create the real file.

### Never bake secrets into an image

Anyone who can pull a derived image can read every file and `ENV` value in it.

- `COPY . /vault` copies the **whole** build context, env files included. Add a
  `.dockerignore` that excludes them:

  ```text
  .git
  .env
  *.env
  .vault.env
  ```

- Do not put secrets in `ENV` lines of the Dockerfile; non-secret settings such as
  `ENV COMPOSE_UP_ARGS="--pull never"` are fine.
- Pass secrets at run time with `-e` / `--env-file` (or the CLI's `.vault.env`).

See [base-image.md → Secrets](base-image.md#secrets).

### What the CLI shows

The CLI never prints env values: `vault status` lists env **keys** only (the `env:` line), and
the CLI never reads the content of `.vault.env` (docker does). `docker inspect` on the Vault
container, however, shows every value to anyone with access to the host's Docker daemon.

See also [security.md → Secrets](security.md#secrets).
