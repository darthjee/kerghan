# Troubleshooting

How to diagnose a Vault stack that fails: error messages, exit codes and common mistakes.
Back to the [Vault guides index](../vault.md).

`docker run` examples use the `darthjee/vault:<version>` placeholder (replace `<version>` with
a published tag) and map host port `8080` to Vault's port `80` (`-p 8080:80`); CLI examples use
the CLI default `3000:80` unless they pass `-p`.

## Startup errors

Before compose starts, Vault checks its settings and privileges, starts the inner `dockerd`
and preloads image tarballs. Any failure there stops the container with exit code `1` and
one message on stderr:

| Message (stderr) | Cause | Fix |
|------------------|-------|-----|
| `VAULT_DOCKERD_TIMEOUT must be a positive integer, got: '<value>'` | `VAULT_DOCKERD_TIMEOUT` is `0`, negative or not a number (e.g. `30s`). | Set a positive integer, e.g. `-e VAULT_DOCKERD_TIMEOUT=60`. See [configuration.md](configuration.md#vault_dockerd_timeout). |
| `dockerd failed to start; are you running with --privileged (or the sysbox runtime)?` | The container lacks the privileges Docker-in-Docker needs, **or** `dockerd` did not become ready within `VAULT_DOCKERD_TIMEOUT` seconds (default `30`). | Run with `--runtime=sysbox-runc` (recommended) or `--privileged`; see [docker-run.md → Runtime](docker-run.md#runtime). If you already do, raise `VAULT_DOCKERD_TIMEOUT` on a slow host. |
| `failed to load image tarball: <file>` | A `/vault/images/*.tar` could not be loaded with `docker load` (corrupt, truncated, not a `docker save` archive). | Recreate it with `docker save -o images/<name>.tar <image>`, or remove it. See [base-image.md → Offline preload](base-image.md#offline-preload). |

The checks run in this order: the timeout value, the privileges, `dockerd` readiness, then the
tarballs (in name order; loading stops at the first failing one).

## Shutdown message

| Message (stderr) | Meaning |
|------------------|---------|
| `vault: docker compose down failed` | On SIGTERM / SIGINT, `docker compose down` failed. Vault only warns: it still stops `dockerd`, and the exit code is not changed by it. |

The shutdown sequence is described in
[operations.md → Shutdown](operations.md#shutdown). If the container is killed before it
finishes, give it a longer stop timeout (see
[operations.md → Stop timeouts](operations.md#stop-timeouts)).

## Exit codes

### The image

| Exit code | When |
|-----------|------|
| compose's exit code | `docker compose` ran: the container exits with its code, also when it was stopped by SIGTERM / SIGINT after compose had started. |
| `1` | A [startup error](#startup-errors). |
| `128 + signal` | SIGTERM / SIGINT received before compose started: `143` (SIGTERM), `130` (SIGINT). |

To find which service failed, read the logs (`docker logs <container>`); see
[operations.md → Logs](operations.md#logs).

### The CLI

| Exit code | When |
|-----------|------|
| The inner command's | `vault compose`, `vault run` and `vault up -f`. |
| `0` | Success, `-h` / `--help`, and `vault status` whatever the state. |
| `1` | Runtime or environment error: Docker unreachable, instance not running, Sysbox requested but missing, rootless Docker, the container failed to start, invalid `.vaultrc` line. |
| `2` | Usage error: unknown command or option, missing or invalid option value, unexpected argument, refused volume or port, `vault` with no command. |

CLI diagnostics go to stderr, prefixed `vault: error:` (the command failed),
`vault: warning:` (it goes on) or `vault: hint:` (what to do next). The full list is in
[cli.md → Exit codes](cli.md#exit-codes) and [cli.md → Messages](cli.md#messages).

## Common mistakes

### Missing privileges

**Symptom:** exit `1` with
`dockerd failed to start; are you running with --privileged (or the sysbox runtime)?`.

**Fix:** a plain `docker run` is not enough. Add `--runtime=sysbox-runc` (Sysbox installed on
the host) or, as a fallback, `--privileged` (read [security.md](security.md) first). The CLI
picks one for you (`--runtime auto`); with `--runtime=sysbox` and no Sysbox it fails with
`vault: error: --runtime=sysbox requested but sysbox-runc is not available`. Rootless Docker is
not supported.

### Host paths in inner bind mounts

**Symptom:** a service starts with an empty or missing directory, or compose fails on a bind
mount source.

**Cause:** bind mounts in the inner compose file refer to the **Vault container's**
filesystem, not the host's. `/home/me/data:/data` points at `/home/me/data` inside the Vault
container, which usually does not exist.

**Fix:** mount (or copy) what the stack needs into the Vault container, usually under
`/vault`, and use relative paths (`./data:/data` resolves to `/vault/data`). See
[concepts.md → Bind mounts](concepts.md#bind-mounts).

### Busy host port

**Symptom:** the container does not start; docker reports `port is already allocated` or
`address already in use`. The CLI adds `vault: hint: choose another host port with -p HOST:80`
and exits `1`.

**Fix:** pick a free host port: `-p 8081:80` with `docker run`, `vault up -p 3001:80` with the
CLI. Check what holds the port (`docker ps`, another Vault instance).

### Wrong port mapping

**Symptom:** the stack runs but nothing answers on the host port.

**Cause:** traffic goes host port → Vault port → inner service; one hop is missing or wrong.

| Hop | Set by | Check |
|-----|--------|-------|
| Host → Vault `80` | `-p 8080:80` (`docker run`), `3000:80` by default (CLI) | The container side is the Vault port, `80`. |
| Vault `80` → inner service | `ports: ["80:3000"]` in the compose file | The left side is the Vault port; the right side is the port the app listens on. |

**Fix:** make both hops agree on the Vault port. See
[concepts.md → Port flow](concepts.md#port-flow).

### Docker Desktop file sharing

**Symptom:** on Docker Desktop (macOS), `/vault` is empty, or a mount fails, so compose finds
no compose file or the stack misses files.

**Fix:** add the project directory and every `-v` source to Docker Desktop's shared file paths
(Settings > Resources > File sharing). The CLI does not check it. See
[cli.md → Docker Desktop](cli.md#docker-desktop).

### Two containers sharing a data volume

**Symptom:** images or inner volumes disappear or get corrupted; inner daemons fail in odd
ways.

**Cause:** two running Vault containers mount the same `/var/lib/docker` volume. Vault does
not detect it. With the CLI, two project directories with the same basename (`~/a/app`,
`~/b/app`) both use `vault-app-data`.

**Fix:** give each container its own volume; with the CLI, pass `--name` (or `name=` in
`.vaultrc`). See [operations.md → Never share the data volume](operations.md#never-share-the-data-volume).
