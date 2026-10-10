# The `kerghan` client

Read by #344. See the [README](README.md) for the feature overview,
[config.md](config.md) for `~/.kerghan/config`, and [variables.md](variables.md) for the env
contract.

## Purpose and platforms

A thin bash wrapper around the `vault` CLI, shipped as `standalone/bin/kerghan`. Supports Linux
and macOS on bash 3.2+, like `vault`. It depends on `vault`, `docker` and `openssl` on the host.

## Commands

```
kerghan up [--offline] [-p PORT] [-f]   # start (detached by default) on http://localhost:3000
kerghan down                            # stop and remove the container; data is kept
kerghan logs [-f]
kerghan status
kerghan compose <args>                  # e.g. `kerghan compose exec mysql sh`
kerghan reset                           # wipe all data (removes vault-kerghan-data), asks for confirmation
kerghan version | help
```

- `-f` on `up` runs in the foreground.
- `--offline` selects the offline image variant for this run.
- Unknown commands or flags print usage and exit non-zero.

## Mapping to `vault`

```
vault <cmd> --name kerghan --image darthjee/kerghan-standalone:<version>[-offline] \
  --env-file ~/.kerghan/kerghan.env -p <port>:80
```

- This yields container `vault-kerghan` and data volume `vault-kerghan-data`.
- `<version>` is pinned in the script at release time, so CLI `<v>` always runs image `<v>`
  (overridable with `image-tag`, see [config.md](config.md)).
- The online and offline variants share the same instance name and data volume.
- The runtime (`sysbox` / `privileged` / `auto`) and stop timeout come from [config.md](config.md).

## Secrets

- On the first `up`, when `~/.kerghan/kerghan.env` does not exist and no data volume exists, the
  client creates `~/.kerghan/` and writes `kerghan.env` with mode 600, containing
  `KERGHAN_SECRET_KEY` and `KERGHAN_INTEGRATIONS_KEY`, each generated with
  `openssl rand -base64 32`.
- It never regenerates or rewrites secrets when the file exists.
- The docs tell users to back up `kerghan.env`: losing it logs everyone out and makes stored
  integration credentials unreadable.

## Refusing to start

`up` refuses to start (non-zero exit, no container created) when `kerghan.env` is missing but the
`vault-kerghan-data` volume exists. The message hints to restore the file or run
`kerghan reset`.

## FRONTEND_BASE_URL

`up` passes `FRONTEND_BASE_URL=http://localhost:<port>` (the effective port) unless
`kerghan.env` sets `FRONTEND_BASE_URL` itself. See
[stack.md](stack.md#same-origin-and-originguard) for why.

## Upgrade and downgrade

- **Upgrade:** install the new CLI, then `kerghan up`. If the running instance uses an older
  image than the CLI's, it is recreated (`down`, then `up`). The data volume is kept, and
  migrations run at backend boot.
- **Downgrade** (an older image against a newer schema) is unsupported. The client warns when the
  installed CLI's version is older than the instance's image, and does not recreate it silently.

## Other behavior

- **Port in use:** surface Vault's error with a hint to use `-p <port>` or set `port=` in
  `~/.kerghan/config`.
- **One instance per host:** the instance name `kerghan` is fixed. Accepted and documented.
- **`reset`:** asks for confirmation (default no), then stops the instance and removes
  `vault-kerghan-data`. It leaves `kerghan.env` in place.
- **`status` / `logs`:** the way to see a failed migration or an unhealthy service.

## Out of scope

Shell completion, a backup command, a `--name` flag (multiple instances).

## Required tests

- The `vault` arguments built for each command, for both variants and with a custom port.
- Secret generation on first `up`, and the file's mode 600.
- No regeneration when `kerghan.env` exists.
- The refusal when `kerghan.env` is missing but the data volume exists.
- Upgrade recreates an instance running an older image, keeping the volume.
- The downgrade warning.
- `reset` asks before deleting, and does nothing when declined.
- The default `FRONTEND_BASE_URL` and its override from `kerghan.env`.
