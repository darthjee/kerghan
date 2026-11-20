# App + Postgres

Back to the [Examples hub](../examples.md), which explains the placeholders and port mappings used below.

```
app-postgres/
├── docker-compose.yml
├── .vault.env        # POSTGRES_PASSWORD=...; never committed
└── .gitignore        # contains .vault.env
```

## Compose file

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
see [configuration.md → Secrets handling](../configuration.md#secrets-handling).

```
# .vault.env
POSTGRES_PASSWORD=change-me
```

## With docker run

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/app-postgres:/vault" \
  -v app-postgres-data:/var/lib/docker \
  -p 8080:80 \
  --env-file app-postgres/.vault.env \
  darthjee/vault:<version>
```

Without Sysbox, use `--privileged` instead of `--runtime=sysbox-runc`; see
[docker-run.md → Runtime](../docker-run.md#runtime) and [security.md](../security.md) first.

## With the CLI

```bash
vault up ./app-postgres
```

The CLI picks the runtime (Sysbox, else `--privileged`) and passes `.vault.env` as an env file
by itself; see [cli.md → `.vault.env`](../cli/config-files.md#vaultenv).

## Result

| | `docker run` | CLI |
|---|--------------|-----|
| App | `http://localhost:8080` | `http://localhost:3000` |
| Postgres | Not published; `app` reaches it as `db:5432`. | Same. |
| Data volume on `/var/lib/docker` | `app-postgres-data` | `vault-app-postgres-data` |
| Database data | Inner named volume `db-data`, kept inside the data volume. | Same. |
