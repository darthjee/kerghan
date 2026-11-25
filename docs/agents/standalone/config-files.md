# Standalone: configuration files

Part of [Standalone Distribution](../standalone.md). The `~/.kerghan/` directory and the `config` format.

## Configuration (`~/.kerghan/`)

| File | Content | Mode |
|---|---|---|
| `~/.kerghan/config` | Client settings. Optional. | user default |
| `~/.kerghan/kerghan.env` | Secrets and backend variables passed to the stack (see [environment-variables/standalone.md](../environment-variables/standalone.md)). Generated on the first `up`. | 600 |

Both files can be edited by hand, or through `kerghan configure` / `kerghan wizard` (see
[`configure` and `wizard`](client.md#configure-and-wizard)).

### `config` format

Flat `key=value`, one per line. Blank lines and `#` comments (whole line or trailing) are ignored,
and surrounding whitespace is trimmed. An empty value means "use the default".

```
port=3000
variant=online        # online | offline
runtime=auto          # auto | sysbox | privileged
stop-timeout=60
image-tag=            # optional override of the pinned image tag
auto-login=true       # true | false
bind=                 # host IPv4 address; default depends on auto-login
restart-on-update=ask # ask | always | never
file-logs=true        # true | false
log-dir=              # host directory; default ~/.kerghan/logs
```

| Key | Values | Default | Overridden by | Passed to Vault as |
|---|---|---|---|---|
| `port` | 1–65535 | `3000` | `-p PORT` | `-p <bind>:<port>:80` (and `FRONTEND_BASE_URL`) |
| `variant` | `online` \| `offline` | `online` | `--offline` | the `-offline` image suffix |
| `runtime` | `auto` \| `sysbox` \| `privileged` | `auto` (Sysbox when installed, else `--privileged`) | none | `--runtime` on `up` |
| `stop-timeout` | seconds, positive integer | `60` | none | `--stop-timeout` on `up` and every `down` |
| `image-tag` | a Docker tag, or empty | the tag pinned in the client | none | the image tag |
| `auto-login` | `true` \| `false` | `true` (`false` when `kerghan.env` has no default user, see [Secrets](client.md#secrets)) | `--auto-login`, `--no-auto-login` | `-e KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` |
| `bind` | an IPv4 address | `127.0.0.1` with auto-login on, `0.0.0.0` with it off | `--bind ADDRESS` | the host IP in `-p <bind>:<port>:80` |
| `restart-on-update` | `ask` \| `always` \| `never` | `ask` (prompt on a terminal; without one, like `never`) | `update --restart`, `update --no-restart` | not passed; read by `kerghan update` only (see [`update`](client.md#update)) |
| `file-logs` | `true` \| `false` | `true` | none | `-e KERGHAN_FILE_LOGS=<effective>` (with `-e KERGHAN_HOST_UID` / `KERGHAN_HOST_GID`) and, when effective, `-v <log-dir>:/vault/logs` |
| `log-dir` | an absolute path or `~/path`, without `:`, whitespace or `#` | `~/.kerghan/logs` | none | the source of the `-v <log-dir>:/vault/logs` mount |

- **Precedence:** command-line flag, then `~/.kerghan/config`, then the default. `--offline`
  selects the offline variant even with `variant=online`; with `variant=offline`, a run without
  the flag uses the offline variant.
- **`image-tag`** must be a valid Docker tag (`[A-Za-z0-9_.-]`, not starting with `.` or `-`, at
  most 128 characters) and must not end in `-offline`. It replaces only the version part:
  `image-tag=0.4.0` with `--offline` runs `darthjee/kerghan-standalone:0.4.0-offline`. An `x.y.z`
  tag gets the usual upgrade and downgrade rules; any other tag skips them (see
  [`up`](client.md#up-start-no-op-or-recreate)).
- **`auto-login` and `bind`:** with auto-login on, anyone who can reach the port is logged in as
  `admin`, so `bind` (default `127.0.0.1`) is the real exposure guard. Auto-login on with a
  non-loopback `bind` (outside `127.0.0.0/8`, for example `bind=0.0.0.0`) prints a warning but
  still starts. The warning says anyone who can reach the port is logged in as admin, with a hint to
  use `--no-auto-login` or `bind=127.0.0.1`. With auto-login off, log in as `admin` with the
  password in `kerghan.env`; sessions created by automatic login stay valid until they expire.
  Only IPv4 bind addresses (four `0-255` octets) are accepted: Docker needs IPv6 host addresses in
  brackets, and IPv6 is not supported. The user-facing URL stays `http://localhost:<port>` with
  any bind. Backend behavior and security rules:
  [Default user and automatic login](../modules/auth/default-user.md).
- **Which commands read it:** only `up`, `down`, `reset`, `update` and `update-env` load the file, before any side effect
  (in `reset`, before the confirmation prompt). `version`, `help`, `logs`, `status` and `compose`
  never read it, so a broken config does not block them.
- **Malformed input:** a line without `=`, or an invalid value for a known key (for example
  `port=abc`), fails with the file name and line number, and the command exits 1 without touching
  the instance. An unknown key only prints a warning, so an older client still works with a config
  written for a newer one. A missing file is not an error.

`standalone/config.example` documents every key, its default, its allowed values and the flag
that overrides it. It ships as the `config.example` release asset; copy it to
`~/.kerghan/config` and uncomment what you want to change.

The format is flat `key=value` because every setting is flat and it parses in plain bash. JSON
(needs `jq`) and YAML (needs a parser such as `yq`) were rejected; reconsider only if nesting is
ever needed.

