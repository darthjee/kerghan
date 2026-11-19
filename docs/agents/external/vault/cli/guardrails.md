# Vault CLI guardrails

Back to the [CLI hub](../cli.md).

## Guardrails

Checked on flags and `.vaultrc` entries alike, by `up` and `run`. Each refusal is a usage
error (exit `2`):

| Refused | Message |
|---------|---------|
| A volume whose source is the host's Docker socket: any path ending in `docker.sock`, or the socket path of a `unix://` `DOCKER_HOST`. | `vault: error: refusing to mount the Docker socket (<source>)` |
| A port whose container side is, or whose range covers, `2375` or `2376` (the Docker daemon ports). Forms: `CONTAINER`, `HOST:CONTAINER`, `IP:HOST:CONTAINER`, with or without `/tcp` / `/udp`. | `vault: error: refusing to publish the Docker daemon port <2375\|2376>` |

See [security.md → Do not mount the host's `docker.sock`](../security.md#do-not-mount-the-hosts-dockersock)
and [security.md → Never expose the inner Docker socket](../security.md#never-expose-the-inner-docker-socket).

## Baked images

For an image that already holds its stack (see [base-image.md](../base-image.md)), pass `--image`
without a `[dir]`:

```bash
vault up --image my-app -p 8080:80
```

Nothing is mounted on `/vault`, and the instance is named after the image (`vault-my-app`,
data volume `vault-my-app-data`). Pass a `[dir]` to mount it anyway. The other commands find
the instance from the same `--image` (or `--name`):

```bash
vault status --image my-app
vault down --image my-app
```

## Docker Desktop

On Docker Desktop (macOS), the project directory and every `-v` source must be in Docker
Desktop's shared file paths (Settings > Resources > File sharing). The CLI does not check it:
make sure every path you mount is shared.
