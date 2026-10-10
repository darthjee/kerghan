# Using the vault CLI

How to install and use the `vault` client, which runs a Vault image on your host for you.
Back to the [Vault guides index](../vault.md).

The `vault` CLI builds the `docker run` command (runtime, mounts, data volume, ports, env) from
a project directory and manages the resulting container:

```bash
cd my-stack            # a directory with a compose file
vault up               # start it, detached, on http://localhost:3000
vault status           # state, image, runtime, ports, volume, env keys
vault compose ps       # run "docker compose ps" inside the instance
vault logs -f          # follow the logs
vault down             # stop and remove it (the data volume is kept)
```

Every command also takes the project directory as an argument (`vault up ./my-stack`);
without it, the current directory is used. Unless said otherwise, examples on this page use
the CLI default port mapping `3000:80` (host `3000` → Vault `80`).

## Supported platforms

| | Supported | Not supported |
|---|-----------|---------------|
| Host OS | Linux and macOS. | Windows. |
| Shell | bash 3.2 or later (the stock macOS bash works). | |
| Docker | A reachable Docker daemon, with Sysbox or accepting `--privileged`. | Rootless Docker (refused by the CLI, whatever the runtime). |

Runtimes, hosts and architectures supported by the image itself are listed in
[security.md → Supported runtimes and platforms](security.md#supported-runtimes-and-platforms).

## Install

Install the CLI with a one-liner:

```bash
curl -fsSL https://github.com/darthjee/vault/releases/latest/download/install.sh | bash
```

The installer needs Docker and never runs `sudo`. It pulls `darthjee/vault:<version>` and
copies the CLI out of that image (its `vault-install` entry, run as the current user, with no
`--privileged` and no inner Docker daemon), so the CLI always matches the image version. By
default it installs:

| What | Where |
|------|-------|
| The `vault` CLI | `~/.local/bin/vault` |
| The shell completions | `~/.local/share/vault/completion/` (`vault.bash`, `_vault`) |

On success it prints `installed vault <version> to <dir>/vault`. Running it again upgrades the
CLI in place.

### Pinning a version

```bash
curl -fsSL https://github.com/darthjee/vault/releases/latest/download/install.sh \
  | VAULT_VERSION=0.0.1 bash
```

### Installer variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VAULT_VERSION` | the release's version | Version of the CLI (and image) to install. |
| `VAULT_INSTALL_DIR` | `$HOME/.local/bin` | Where the `vault` CLI is installed (created when missing; must be writable). |
| `VAULT_IMAGE` | `darthjee/vault:$VAULT_VERSION` | Image the CLI is copied from. |

These variables only affect the installer: the installed CLI reads none of them. The
completion directory is always `~/.local/share/vault/completion/`.

### PATH

If the install dir is not in `PATH`, the installer warns and prints the line to add; the
install still succeeds:

```
vault: warning: /home/me/.local/bin is not in PATH; add: export PATH="/home/me/.local/bin:$PATH"
```

Add that line to your shell profile (`~/.bashrc`, `~/.zshrc`).

### Installer errors

| Message (stderr) | Cause |
|------------------|-------|
| `vault: error: docker not found in PATH` | Docker is not installed or not in `PATH`. |
| `vault: error: cannot reach the Docker daemon` | The daemon is down, or this user cannot access it. |
| `vault: error: <dir> is not writable` | `VAULT_INSTALL_DIR` cannot be created or written. |
| `vault: error: failed to install from <image>` | The image could not be pulled or run (e.g. unknown `VAULT_VERSION`). |

All of them exit `1`.

## Download and verify

Release tags are not immutable, and `curl | bash` runs whatever the URL serves. Each GitHub
release publishes these assets:

| Asset | Content |
|-------|---------|
| `vault` | The CLI (a single bundled script). |
| `install.sh` | The installer. |
| `vault.bash` | The bash completion. |
| `_vault` | The zsh completion. |
| `SHA256SUMS` | SHA-256 checksums of the four files above. |

To verify the installer before running it:

```bash
base=https://github.com/darthjee/vault/releases/latest/download
curl -fsSLO "$base/install.sh"
curl -fsSLO "$base/SHA256SUMS"
sha256sum -c --ignore-missing SHA256SUMS      # Linux
shasum -a 256 -c --ignore-missing SHA256SUMS  # macOS
bash install.sh
```

The releases are listed on the
[GitHub releases page](https://github.com/darthjee/vault/releases).

## Shell completion

Enable completion in your shell:

```bash
# bash (~/.bashrc)
source ~/.local/share/vault/completion/vault.bash

# zsh (~/.zshrc, before compinit)
fpath=(~/.local/share/vault/completion $fpath)
```

Completion covers the commands, their options, `--runtime` values, files for `--env-file` and
`-v`, directories for `[dir]`, and existing instance names for `--name`.

## Commands

```
vault <command> [options] [dir] [args]
```

| Command | Behaviour |
|---------|-----------|
| `vault up [options] [dir]` | Starts the instance `vault-<name>`. Detached by default (prints `vault-<name> started`); `-f` / `--attach` runs it in the foreground, where Ctrl+C triggers the graceful shutdown. Already running: no-op, prints `vault-<name> is already running` and the status. Stopped: removed, then started again with the current options (the data volume is kept). |
| `vault down [options] [dir]` | Stops (`docker stop -t <stop-timeout>`) and removes the instance; prints `vault-<name> stopped and removed (volume vault-<name>-data kept)`. The data volume is **never** removed. A missing instance is not an error (`vault-<name> does not exist`). |
| `vault logs [options] [-f] [dir]` | Shows the instance logs; `-f` / `--follow` follows them. Fails when the instance is not running. |
| `vault status [options] [dir]` | Prints the name, state (`running`, `stopped`, `not found`), image, runtime, ports, volume and env keys (never values). Exits `0` whatever the state. |
| `vault compose [options] <args>` | Runs `docker compose <args>` inside the running instance. Fails when the instance is not running. |
| `vault run [options] [dir] <args>` | One-shot `docker run --rm` in the foreground, passing `<args>` to the image. Refused while the instance is running, since both would share its data volume. |
| `vault version` | Prints `vault X.Y.Z`. |
| `vault help` | Prints the usage. `-h` / `--help` works on every command. |

Examples:

```bash
vault up                     # detached, on http://localhost:3000
vault up -f                  # foreground; Ctrl+C stops the stack gracefully
vault up ./my-stack          # another project directory
vault down                   # stop and remove; the data volume is kept
vault logs -f                # follow the logs
vault status                 # state, image, runtime, ports, volume, env keys
vault compose ps             # docker compose ps inside the instance
vault compose exec app sh    # a shell in the app service
vault run config             # one-shot: print the resolved compose file
vault version                # vault X.Y.Z
vault help                   # the usage
```

`vault status` prints one line per field, e.g.:

```
name:     vault-my-stack
state:    running
image:    darthjee/vault:0.0.1
runtime:  sysbox-runc
ports:    3000->80/tcp
volume:   vault-my-stack-data
env:      COMPOSE_UP_ARGS
```

A missing instance prints only `name:` and `state:    not found`.

### Arguments of `compose` and `run`

- `compose` and `run` stop parsing options at the first argument that is not a CLI option;
  it and everything after it go to `docker compose`.
- `compose` takes no `[dir]`: it targets the instance of the current directory, or the one
  given with `--name`.
- For `run`, the first positional argument is `[dir]` only if it is an existing directory;
  otherwise it is the first compose argument. Put `--` before an argument that happens to name
  a directory: `--` ends the options.
- `up` and `run` warn when the project directory has no `compose.yaml`, `compose.yml`,
  `docker-compose.yaml` or `docker-compose.yml`
  (`no compose file found in <dir>; relying on COMPOSE_FILE`), and go on.

### Exit codes

| Exit code | When |
|-----------|------|
| The inner command's | `compose`, `run` and `up -f`. |
| `0` | Success, `-h` / `--help`, and `status` whatever the state. |
| `1` | Runtime or environment error: Docker unreachable, instance not running, Sysbox requested but missing, rootless Docker, the container failed to start, invalid `.vaultrc` line. |
| `2` | Usage error: unknown command or option, missing or invalid option value, unexpected argument, refused volume or port, `vault` with no command. |

### Messages

Results (`vault-<name> started`, the status block, `vault X.Y.Z`) go to stdout. Diagnostics go
to stderr, one line each, with a prefix:

| Prefix | Meaning |
|--------|---------|
| `vault: error:` | The command failed. |
| `vault: warning:` | The command goes on, but check the message. |
| `vault: hint:` | What to do next, printed after an error. |

Common ones:

| Message | Meaning |
|---------|---------|
| `vault: error: docker not found in PATH` | Install Docker or fix `PATH`. |
| `vault: error: cannot reach the Docker daemon` | The daemon is down, or this user cannot access it. |
| `vault: error: instance vault-<name> is not running` | `logs` / `compose` need a running instance: `vault up` first. |
| `vault: error: instance vault-<name> is running` | `run` is refused while the instance runs: `vault down`, or use `vault compose`. |
| `vault: error: directory not found: <dir>` | `up` / `run` got a `[dir]` that does not exist. |
| `vault: hint: choose another host port with -p HOST:80` | The host port is already in use. |

## Instances

Each project runs as one named instance. The name is, in order:

1. `--name`, else `name=` in [`.vaultrc`](#vaultrc);
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
[concepts.md → Persistence](concepts.md#persistence). Remove it by hand
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
  Read [security.md → `--privileged` is dangerous](security.md#--privileged-is-dangerous)
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
  interpret them. They are described in [configuration.md](configuration.md#environment-variables).

  ```bash
  vault up -e COMPOSE_UP_ARGS="--abort-on-container-exit" -p 8080:80
  ```

- What the stop timeout covers (the shutdown sequence) is described in
  [operations.md → Shutdown](operations.md#shutdown).

## `.vault.env`

When `.vault.env` exists in `[dir]` (else in the current directory), `up` and `run` pass it
as the first `--env-file`, so explicit env files and `-e` win over it. A `--env-file` flag
never drops it. The CLI never reads its content; docker does.

```
# .vault.env
COMPOSE_UP_ARGS=--abort-on-container-exit
DATABASE_PASSWORD=change-me
```

It usually holds secrets: keep it out of git (add `.vault.env` to `.gitignore`). `vault status`
shows env keys only, never values. Secrets handling is detailed in
[configuration.md → Secrets handling](configuration.md#secrets-handling); see also [security.md → Secrets](security.md#secrets).

## `.vaultrc`

Per-project defaults live in `.vaultrc`, read from `[dir]` (else from the current directory):

```
# .vaultrc
name=my-app
image=darthjee/vault:0.0.1
runtime=sysbox
port=3000:80
port=3443:443
volume=./shared:/shared
env=RAILS_ENV=production
env-file=.env.prod
stop-timeout=90
```

| Key | Option | Repeatable |
|-----|--------|------------|
| `name` | `--name` | no (last line wins) |
| `image` | `--image` | no (last line wins) |
| `runtime` | `--runtime` | no (last line wins) |
| `stop-timeout` | `--stop-timeout` | no (last line wins) |
| `port` | `-p`, `--port` | yes, one entry per line |
| `volume` | `-v`, `--volume` | yes, one entry per line |
| `env` | `-e`, `--env` | yes, one entry per line |
| `env-file` | `--env-file` | yes, one entry per line |

- One `key=value` per line. The value is taken verbatim: no quoting, no variable expansion, no
  `~` expansion. `#` starts a comment only at the beginning of a line; blank lines are
  skipped.
- The file is parsed, **never sourced**: it cannot run commands.
- Relative `volume` sources (starting with `.` or containing `/`) and relative `env-file`
  paths resolve against the directory holding `.vaultrc`. A bare volume name (`data:/data`)
  stays a named volume. Relative paths given as flags are passed to docker as given.
- `image=` changes the image only: unlike `--image`, it does not change the name default nor
  skip the `/vault` mount.
- An unknown key warns (`vault: warning: .vaultrc:<line>: unknown key '<key>'`) and is skipped.
- A line without `=` (`.vaultrc:<line>: expected key=value`) or an invalid value
  (`.vaultrc:<line>: invalid value for <key>: '<value>'`) fails with exit `1`.

### Precedence

**Flags > `.vaultrc` > built-in defaults.**

- Single-value keys: the flag, else the `.vaultrc` value, else the default.
- Repeatable keys: any flag replaces every `.vaultrc` entry of that key (one `-p` drops all
  `port=` lines). `.vault.env` is not a `.vaultrc` entry: it always stays first.

```bash
vault up                  # ports 3000:80 and 3443:443, from .vaultrc
vault up -p 8080:80       # port 8080:80 only
vault up --runtime=auto   # overrides runtime=sysbox
```

## Guardrails

Checked on flags and `.vaultrc` entries alike, by `up` and `run`. Each refusal is a usage
error (exit `2`):

| Refused | Message |
|---------|---------|
| A volume whose source is the host's Docker socket: any path ending in `docker.sock`, or the socket path of a `unix://` `DOCKER_HOST`. | `vault: error: refusing to mount the Docker socket (<source>)` |
| A port whose container side is, or whose range covers, `2375` or `2376` (the Docker daemon ports). Forms: `CONTAINER`, `HOST:CONTAINER`, `IP:HOST:CONTAINER`, with or without `/tcp` / `/udp`. | `vault: error: refusing to publish the Docker daemon port <2375\|2376>` |

See [security.md → Do not mount the host's `docker.sock`](security.md#do-not-mount-the-hosts-dockersock)
and [security.md → Never expose the inner Docker socket](security.md#never-expose-the-inner-docker-socket).

## Baked images

For an image that already holds its stack (see [base-image.md](base-image.md)), pass `--image`
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
