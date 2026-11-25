# Plan: Standalone: write the inner services' logs to a host directory

Issue: [596-standalone-write-the-inner-services-logs-to-a-host-directory.md](../../issues/596-standalone-write-the-inner-services-logs-to-a-host-directory.md)

## Overview

Add a `logs` collector service to the standalone inner compose stack. It follows the `tent` and
`kerghan` containers through the inner Docker socket and writes timestamped, size-rotated files
(10 MB × 5 per service) to `/vault/logs`, which the `kerghan` client bind-mounts from a host
directory owned by the host user. Two new client config keys control it: `file-logs` and
`log-dir`. Docker's own `json-file` copies of the inner services' logs are bounded. The offline
image preloads the collector's Docker CLI image.

#606 (the Tent access-log format) is a prerequisite handled separately. This plan does not touch
the Tent configuration.

## Agents involved

- [standalone](standalone.md): inner compose stack, collector script, Dockerfile, `kerghan`
  client, bats tests, smoke test, standalone docs, README, `config.example`.
- [infra](infra.md): `bin/release_kerghan_standalone.sh` (offline tarball list) and its docs.

## Shared contracts

### Collector image

- **Image:** the official Docker CLI image pinned to an exact patch tag, `docker:<X.Y.Z>-cli`. The
  implementer picks the current stable patch at implementation time. It must be a multi-arch index
  covering `linux/amd64` and `linux/arm64`, and its client API must negotiate with the inner
  daemon of `darthjee/vault:0.1.0`.
- **Single source of truth for the tag:** the `standalone` agent writes it in
  `dockerfiles/kerghan_standalone/Dockerfile`, into `/vault/.env` as `LOGS_IMAGE=<image>` next to
  `TENT_IMAGE` and `KERGHAN_VERSION`. It is the same value for both architectures. The compose
  `logs` service uses `image: ${LOGS_IMAGE}`.
- **Release script:** the `infra` agent adds a `LOGS_IMAGE` constant with the **exact same string**
  to `bin/release_kerghan_standalone.sh`.
- **Offline tarball name:** `standalone/images/<arch>/docker-cli.tar`, saved with
  `save_image "$arch" "$LOGS_IMAGE" docker-cli`.
- **Smoke test:** the `standalone` agent adds `LOGS_IMAGE` to `check_offline`'s
  expected-preloaded list in `standalone/scripts/smoke_test.sh`. It reads the value from the
  image's `/vault/.env`, or uses a matching constant.

### Environment variables (client → Vault container → inner compose)

Owned by `standalone` and listed here because they define the stack's interface:

| Variable | Set by | Value | Consumed by |
|---|---|---|---|
| `KERGHAN_FILE_LOGS` | client `-e`, every `up` | `true` / `false` (effective: `false` when disabled or the directory is unwritable) | `logs` service (idles when `false`) |
| `KERGHAN_HOST_UID` | client `-e`, every `up` | `id -u` of the host user | `logs` service (`chown`) |
| `KERGHAN_HOST_GID` | client `-e`, every `up` | `id -g` of the host user | `logs` service (`chown`) |

- All three join `CLIENT_MANAGED_KEYS`, so a `kerghan.env` line for them is refused.
- They reach only the `logs` service's `environment:`, never `kerghan`'s allowlist.

### Bind mount

When file logs are effectively on, the client adds `-v <resolved log-dir>:/vault/logs`. When they
are off, there is no `-v`.
