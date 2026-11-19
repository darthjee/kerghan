# Vault CLI commands

Back to the [CLI hub](../cli.md).

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

