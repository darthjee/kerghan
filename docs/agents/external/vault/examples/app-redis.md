# App + Redis

Back to the [Examples hub](../examples.md), which explains the placeholders and port mappings used below.

```
app-redis/
└── docker-compose.yml
```

## Compose file

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

## With docker run

```bash
docker run --runtime=sysbox-runc \
  -v "$PWD/app-redis:/vault" \
  -v app-redis-data:/var/lib/docker \
  -p 8080:80 \
  darthjee/vault:<version>
```

Without Sysbox, use `--privileged` instead of `--runtime=sysbox-runc`; see
[docker-run.md → Runtime](../docker-run.md#runtime) and [security.md](../security.md) first.

## With the CLI

```bash
vault up ./app-redis
```

## Result

| | `docker run` | CLI |
|---|--------------|-----|
| App | `http://localhost:8080` | `http://localhost:3000` |
| Redis | Not published; `app` reaches it as `redis:6379`. | Same. |
| Data volume on `/var/lib/docker` | `app-redis-data` | `vault-app-redis-data` |
| Redis data | Inner named volume `redis-data`, kept inside the data volume. | Same. |
