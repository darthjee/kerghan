# Multiple compose files

Back to the [Examples hub](../examples.md), which explains the placeholders and port mappings used below.

```
app-multi/
├── compose.yml
└── compose.prod.yml
```

## Compose files

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
[configuration.md → Multiple compose files](../configuration.md#multiple-compose-files).

## With docker run

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/app-multi:/vault" \
  -v app-multi-data:/var/lib/docker \
  -p 8080:80 \
  -e COMPOSE_FILE=compose.yml:compose.prod.yml \
  darthjee/vault:<version>
```

Without Sysbox, use `--privileged` instead of `--runtime=sysbox-runc`; see
[docker-run.md → Runtime](../docker-run.md#runtime) and [security.md](../security.md) first.

## With the CLI

```bash
vault up -e COMPOSE_FILE=compose.yml:compose.prod.yml ./app-multi
```

To avoid repeating it, put `env=COMPOSE_FILE=compose.yml:compose.prod.yml` in the project's
`.vaultrc`; see [cli.md → `.vaultrc`](../cli/config-files.md#vaultrc).

## Result

| | `docker run` | CLI |
|---|--------------|-----|
| App | `http://localhost:8080`, running `my-app:1.0` with `APP_ENV=production` | `http://localhost:3000`, same |
| Data volume on `/var/lib/docker` | `app-multi-data` | `vault-app-multi-data` |

Leave `COMPOSE_FILE` out to run `compose.yml` alone.
