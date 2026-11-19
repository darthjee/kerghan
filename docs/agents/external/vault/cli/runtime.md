# Vault CLI instances, runtime and options

Back to the [CLI hub](../cli.md).

## Instances

Each project runs as one named instance. The name is, in order:

1. `--name`, else `name=` in [`.vaultrc`](config-files.md#vaultrc);
2. else, with `--image` and no `[dir]`, the image name without registry, path and tag
   (`registry.example.com/team/my-app:1.0` gives `my-app`);
3. else the basename of `[dir]` (else of the current directory).

Derived names are lowercased and stripped of any character outside `[a-z0-9_.-]` (`My App!`
gives `myapp`). Explicit names must match `[a-z0-9][a-z0-9_.-]*`. When nothing usable is
left, the CLI fails with `cannot derive an instance name from '<base>'` and the hint
`pass --name <name>`.

| Resource | Name |
|----------|------|
| Container | `vault-<name>` |
| Data volume | `vault-<name>-data`, mounted on `/var/lib/docker` |

The data volume keeps the inner images and the inner named volumes across `down` / `up`; see
[concepts.md → Persistence](../concepts.md#persistence). Remove it by hand
(`docker volume rm vault-<name>-data`) to start from scratch.

> **Warning:** two instances must never share a data volume. Two project directories with the
> same basename (e.g. `~/a/app` and `~/b/app`) both resolve to `vault-app-data`. The CLI does
> not detect it: pass `--name` (or set `name=` in `.vaultrc`) to tell them apart.

```bash
vault up --name app-a ~/a/app
vault up --name app-b -p 3001:80 ~/b/app
```

## Runtime

`up` and `run` pick the runtime with `--runtime` (default `auto`):

| `--runtime` | Sysbox available | Result |
|-------------|------------------|--------|
| `auto` | yes | `--runtime=sysbox-runc`. |
| `auto` | no | `--privileged`, with a warning. |
| `sysbox` | yes | `--runtime=sysbox-runc`. |
| `sysbox` | no | Error, exit `1`. No fallback. |
| `privileged` | either | `--privileged`, no warning. |

- Sysbox is detected when `docker info` lists the `sysbox-runc` runtime.
- The `auto` fallback prints
  `vault: warning: sysbox-runc not found; running with --privileged (see Security in the README)`.
  Read [security.md → `--privileged` is dangerous](../security.md#--privileged-is-dangerous)
  before relying on it.
- Use `--runtime=sysbox` to make sure the CLI never falls back to `--privileged`; without
  Sysbox it fails with `--runtime=sysbox requested but sysbox-runc is not available`.
- If a run with Sysbox fails to start, the CLI never retries with `--privileged`: it shows
  docker's error, then `sysbox-runc failed to start the container` and the hint
  `fix sysbox or use --runtime=privileged`.
- Rootless Docker is refused, whatever the runtime (`rootless Docker is not supported`).

## Options

| Option | Commands | Default | Meaning |
|--------|----------|---------|---------|
| `--name <name>` | all | see [Instances](#instances) | Instance name. |
| `--image <image>` | all | `darthjee/vault:<CLI version>` | Image to run. On `down`, `logs`, `status` and `compose` it only feeds the name default. |
| `--runtime <auto\|sysbox\|privileged>` | `up`, `run` | `auto` | See [Runtime](#runtime). |
| `-p`, `--port <HOST:CONTAINER>` | `up`, `run` | `3000:80` | Published port; repeatable. |
| `-v`, `--volume <SRC:DST>` | `up`, `run` | none | Extra mount; repeatable. |
| `-e`, `--env <KEY=VALUE>` | `up`, `run` | none | Env var for the Vault container; repeatable. |
| `--env-file <file>` | `up`, `run` | none | Env file; repeatable. |
| `--stop-timeout <seconds>` | `up`, `run`, `down` | `60` | Seconds to wait for the graceful shutdown before docker kills the container (positive integer). |
| `-f`, `--attach` | `up` | off | Run in the foreground. |
| `-f`, `--follow` | `logs` | off | Follow the logs. |
| `-h`, `--help` | all | off | Print the usage. |

- Value options take `--opt value`; long ones also take `--opt=value`.
- An option not valid for the command is a usage error (`unknown option '<opt>'`, exit `2`).
- Ports: the default `3000:80` maps host `3000` to Vault's port `80`. Any `-p` replaces it, so
  repeat `-p` for every port you need:

  ```bash
  vault up -p 8080:80 -p 8443:443
  ```

- The image's environment variables (`COMPOSE_UP_ARGS`, `VAULT_DOCKERD_TIMEOUT`,
  `COMPOSE_FILE`, other `COMPOSE_*`) are passed with `-e` or an env file; the CLI does not
  interpret them. They are described in [configuration.md](../configuration.md#environment-variables).

  ```bash
  vault up -e COMPOSE_UP_ARGS="--abort-on-container-exit" -p 8080:80
  ```

- What the stop timeout covers (the shutdown sequence) is described in
  [operations.md → Shutdown](../operations.md#shutdown).

