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

## Pages

| Page | Contents |
|------|----------|
| [app-postgres.md](examples/app-postgres.md) | App + Postgres: compose file, password in `.vault.env`, `docker run` and CLI variants. |
| [app-redis.md](examples/app-redis.md) | App + Redis: compose file with a Redis service and its inner volume, `docker run` and CLI variants. |
| [multiple-compose-files.md](examples/multiple-compose-files.md) | Multiple compose files: merging `compose.yml` and `compose.prod.yml` with `COMPOSE_FILE`. |
| [baked-image-offline.md](examples/baked-image-offline.md) | Baked image with offline preload: building an image with the inner images saved in it, run with `docker run` or `vault up --image`. |
