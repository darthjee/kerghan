# Inner stack: `logs` collector service and bounded Docker logs

Add the collector to the inner compose stack and cap Docker's own log copies.

## Dockerfile

In the `.env` step of `dockerfiles/kerghan_standalone/Dockerfile`, write
`LOGS_IMAGE=docker:<X.Y.Z>-cli` next to `TENT_IMAGE` and `KERGHAN_VERSION`. It is the same value
for both architectures, since the official image is multi-arch. Update the offline-stage comment
that lists the preloaded tarballs to add `docker-cli.tar`.

The collector script lives in `standalone/vault/logs/collect.sh`. It is copied into the image by
the existing `COPY standalone/vault/ /vault/`.

## `standalone/vault/docker-compose.yml`

Add a `logs` service:

```yaml
  logs:
    image: ${LOGS_IMAGE}
    restart: unless-stopped
    init: true            # the script is not PID 1, so it can be killed and restarted
    entrypoint: ["/bin/sh", "/collector/collect.sh"]
    environment:
      - KERGHAN_FILE_LOGS=${KERGHAN_FILE_LOGS:-false}
      - KERGHAN_HOST_UID=${KERGHAN_HOST_UID:-0}
      - KERGHAN_HOST_GID=${KERGHAN_HOST_GID:-0}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./logs:/logs
      - ./logs-collector:/collector:ro   # or wherever collect.sh lives under /vault
    logging: *bounded-logging
```

- No other service `depends_on` it, so Kerghan never waits on it.
- It is the only service that gets the socket.
- Update the header comment: the `KERGHAN_HOST_*` and `KERGHAN_FILE_LOGS` variables go only to
  `logs`, never to `kerghan`'s allowlist.
- Bind-mount sources resolve against `/vault`, so `./logs` is `/vault/logs`, the host mount point.
  When the client mounts nothing, it is a directory inside the Vault container.

Add a YAML anchor (`x-logging: &bounded-logging`) with
`driver: json-file, options: {max-size: "10m", max-file: "5"}`. Apply it to `mysql`,
`mysql-legacy`, `kerghan`, `tent` and `logs`.

## `collect.sh` (POSIX `sh`, busybox/alpine)

1. If `KERGHAN_FILE_LOGS` is not `true`, idle forever (`exec sleep 2147483647`, or a `while sleep`
   loop) so `restart: unless-stopped` does not loop.
2. `umask 077`. Create `/logs` if missing. `chown "$KERGHAN_HOST_UID:$KERGHAN_HOST_GID" /logs` and
   `chmod 700 /logs`. Every failure here is logged to stderr, and the script keeps going.
3. For each service, `tent` and `kerghan`, run a background follower loop:
   - Find the container id with
     `docker ps -q --filter label=com.docker.compose.service=<svc> --filter label=com.docker.compose.project=<project>`.
     Find the project from the collector's own container labels
     (`docker inspect "$HOSTNAME" --format '{{index .Config.Labels "com.docker.compose.project"}}'`),
     so it never hard-codes `vault`.
   - `docker logs -f -t --since <last timestamp written> <id> 2>&1`, piped into the rotating
     writer. Use `--since` with the last line's timestamp, persisted in `/logs/.<svc>.since`, so a
     reattach after a restart or recreate does not duplicate lines. When the stream ends
     (container stopped or recreated), sleep 2 s and loop to resolve the id again.
4. **Rotating writer** (a shell `while IFS= read -r line` loop, or `awk`): append to
   `/logs/<svc>.log`. When the size reaches 10 MB, shift `<svc>.log.4` → `.5` … `.log` → `.log.1`,
   dropping `.5`, and start a new file. `chown` and `chmod 600` each file when it is created.
   - Keep it simple and portable. If the `while read` loop is too slow, `awk` with a byte counter
     is fine.
5. `wait`. If a follower dies, the script exits non-zero and compose restarts the service.

Service → file mapping: `tent` → `tent.log`, which holds the Apache access and error output (both
go to stdout and stderr). `kerghan` → `kerghan.log`, the backend and its workers. MySQL is not
collected.

## Files to Change

- `dockerfiles/kerghan_standalone/Dockerfile`: `LOGS_IMAGE` in `/vault/.env`, and the offline-stage
  comment.
- `standalone/vault/docker-compose.yml`: the `logs` service, the logging anchor on every service,
  and the header comment.
- `standalone/vault/logs-collector/collect.sh` (new; the folder name is up to you as long as it is
  not `./logs`, the mount point): the collector.
