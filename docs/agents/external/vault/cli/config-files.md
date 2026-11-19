# Vault CLI config files

Back to the [CLI hub](../cli.md).

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
[configuration.md → Secrets handling](../configuration.md#secrets-handling); see also [security.md → Secrets](../security.md#secrets).

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

