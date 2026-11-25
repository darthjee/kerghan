# Standalone: the `kerghan` client

Part of [Standalone Distribution](../standalone.md). How the `kerghan` client wraps the `vault` CLI, its secrets, `up` and other behavior.

## The `kerghan` client

```
kerghan up [--offline] [-p PORT] [--[no-]auto-login] [--bind ADDRESS] [-f]
                                        # start (detached by default) on http://localhost:3000
kerghan down                            # stop and remove the container; data is kept
kerghan logs [-f]                       # show (or follow) the logs
kerghan status                          # show the instance state
kerghan compose <args>                  # docker compose inside the instance, e.g. compose exec mysql sh
kerghan reset                           # wipe all data, asks for confirmation
kerghan update [VERSION] [--force] [--yes] [--[no-]restart]
                                        # update the client and the image to VERSION (default: the latest release)
kerghan update-env                      # add missing variables to ~/.kerghan/kerghan.env (keeps existing values)
kerghan configure [--show-secrets] [KEY]
                                        # list the settings in ~/.kerghan/config and kerghan.env, or print KEY
kerghan configure [--force] [--unset KEY]... [KEY=VALUE | KEY=-]...
                                        # set or unset settings (all or nothing); KEY=- reads the value hidden
kerghan wizard [--advanced]             # set up the settings interactively (--advanced asks every setting)
kerghan completion bash                 # print the bash completion script (eval "$(kerghan completion bash)")
kerghan version | help
```

- `-p` / `--port` sets the host port, `--offline` selects the offline image variant for this run,
  and `-f` runs in the foreground.
- `--auto-login` / `--no-auto-login` turn automatic login as the default `admin` user on or off
  (the last one wins), and `--bind ADDRESS` sets the host IPv4 address the port is published on.
  See `auto-login` and `bind` under [`config` format](config-files.md#config-format).
- An unknown command or option prints the usage and exits 2.

### Mapping to `vault`

Every command calls `vault` with the fixed instance name `kerghan`, which gives the container
`vault-kerghan` and the data volume `vault-kerghan-data`:

```
vault up --name kerghan --image darthjee/kerghan-standalone:<tag>[-offline] \
  --env-file ~/.kerghan/kerghan.env -p <bind>:<port>:80 [-e FRONTEND_BASE_URL=http://localhost:<port>] \
  -e KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=<auto-login> \
  -e KERGHAN_DEFAULT_USER_ALLOWED_IPS=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16 \
  -e KERGHAN_COOKIE_SECURE=<true|false|loopback> \
  --runtime <runtime> --stop-timeout <seconds> [-f]
vault down --name kerghan --stop-timeout <seconds>
vault logs|status|compose --name kerghan ...
```

- `<tag>` is the version pinned in the client (`KERGHAN_VERSION`, stamped by
  `scripts/bump_version.sh`), so client `<v>` runs image `<v>`. `image-tag` in the config
  overrides it.
- The online and offline variants share the instance name and the data volume, so switching
  between them keeps the data.
- `--runtime` and `--stop-timeout` come from the config (defaults `auto` and `60`). The stop
  timeout is passed on every `down`: `kerghan down`, the `down` before a recreation, and `reset`.
- `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` and `KERGHAN_DEFAULT_USER_ALLOWED_IPS` are always
  passed with `-e`, so `auto-login` stays the single source of truth. `kerghan.env` must not set
  them (unlike `FRONTEND_BASE_URL`): the value would reach the container twice, and which copy
  wins along the Docker, Vault and inner compose chain is not guaranteed. When `kerghan.env` has
  a line for either key (also indented, empty, or a bare `KEY` line, which Docker reads from the
  environment), `up` fails (exit 1, nothing started or recreated) with an error naming the keys
  and a hint to remove the lines and use `auto-login` / `bind` instead.
- The `KERGHAN_DEFAULT_USER_ALLOWED_IPS` value is loopback plus the private ranges
  (`DEFAULT_USER_ALLOWED_IPS` in `bin/kerghan`). The allowlist is not the exposure guard:
  **`bind=127.0.0.1` is**. With the default bind, only processes on the host can reach the port
  at all. It stays the full private-range list, not just the observed gateway, because the
  address the backend sees depends on the host's Docker networking (see
  [Effective client IP](inner-stack.md#effective-client-ip)).
- `vault` always runs from `~/.kerghan`, so a stray `.vaultrc` or `.vault.env` in the user's
  working directory cannot change the instance.

### Secrets

On the first `up`, when `~/.kerghan/kerghan.env` does not exist and no data volume exists, the
client creates `~/.kerghan/` and writes `kerghan.env` (mode 600) with `KERGHAN_SECRET_KEY` and
`KERGHAN_INTEGRATIONS_KEY`, each from `openssl rand -base64 32`, plus the default user:
`KERGHAN_DEFAULT_USER_ENABLED=true`, `KERGHAN_DEFAULT_USER_USERNAME=admin`,
`KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local`, `KERGHAN_DEFAULT_USER_PASSWORD` (from
`openssl rand -hex 24`, used for a manual login when `auto-login` is off) and
`KERGHAN_DEFAULT_USER_ADMIN=true`. It never regenerates or rewrites an existing file, so an
installation created by an older client has no default user in its `kerghan.env` until
`kerghan update-env` adds it (see [`update-env`](#update-env)). The key list and value generators
(`DEFAULT_ENV_KEYS`, `default_env_value` in `bin/kerghan`) are shared by both, so they cannot
drift apart.

The backend refuses to boot with automatic login on and no default-user credentials. So when
`kerghan.env` lacks a non-blank `KERGHAN_DEFAULT_USER_USERNAME`, `KERGHAN_DEFAULT_USER_EMAIL` or
`KERGHAN_DEFAULT_USER_PASSWORD` (a pre-#371 file):

- with `auto-login` not set (no flag, no config value), `up` resolves it to `false`, so `bind`
  defaults to `0.0.0.0` (the pre-#371 behavior), and prints a notice to run `kerghan update-env`,
  then `kerghan up` again, to turn it on;
- with `auto-login=true` set by `--auto-login` or the config, `up` fails (exit 1, nothing started)
  with an error and a hint to run `kerghan update-env` or turn automatic login off.

`up` refuses to start (exit 1, no container created) when `kerghan.env` is missing but the
`vault-kerghan-data` volume exists: the data was written with secrets that are gone. The hint
says to restore the file from a backup, or to run `kerghan reset`.

#### `update-env`

`kerghan update-env` is the explicit way to bring a `kerghan.env` written by an older client up to
date (upgrading the client never modifies it):

- It appends, at the end of the file and in the `ensure_env_file` order, every default key the file
  has no line for, with the values a new installation gets (fresh secrets, a generated
  `KERGHAN_DEFAULT_USER_PASSWORD`, the fixed `admin` / `admin@kerghan.local` / `true` values). Only
  the missing values are generated.
- A key counts as present when the file has any line for it: indented, with an empty value, or a
  bare `KEY` line (the same rule as the client-managed check). Present lines are never edited and
  never duplicated. Existing content and order are kept byte for byte; a missing trailing
  newline is added before appending. The file is mode 600 afterwards and is written atomically
  (a temp file in the target's directory under umask `077`, renamed into place, through a
  symlinked `kerghan.env` to its target), so its inode changes; a failed write leaves it
  untouched, removes the temp file and exits 1 with `could not write ...; it was left unchanged`.
  The `kerghan.env` generated by `up` is written the same way (`write_file_atomic`, shared with
  `configure` / `wizard`).
- `KERGHAN_COOKIE_SECURE` is also always passed and client-managed (refused in `kerghan.env`, with
  a hint to set an `https` `FRONTEND_BASE_URL` to keep `Secure`). It is `false` iff the `bind` is
  loopback and the effective `FRONTEND_BASE_URL` (`kerghan.env`, else the derived default) does not
  start with `https://`. On a non-loopback `bind` it is `loopback` (the backend drops `Secure` per
  request, only for a loopback `Host` over plain HTTP) unless the effective `FRONTEND_BASE_URL` is
  `https://`; an `https` URL gives `true` on any bind.
- A present but blank key is left as it is, with a warning naming it. For the default-user
  credentials (`USERNAME`, `EMAIL`, `PASSWORD`) a hint adds that `up` still treats the default
  user as missing.
- It never writes `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`,
  `KERGHAN_DEFAULT_USER_ALLOWED_IPS` or `KERGHAN_COOKIE_SECURE` (client-managed).
- It prints the names of the keys it added, never their values, then
  `Run 'kerghan down && kerghan up' to apply the change.`; or says the file is up to date. A second
  run adds nothing. Both exit 0, blank-key warnings included.
- When `kerghan.env` does not exist it exits 1 and writes nothing. The hint says to run
  `kerghan up` for a new installation, or, when `vault-kerghan-data` exists, to restore the file
  from a backup (new secrets would not match the data) or run `kerghan reset`.
- It does not take options, loads `~/.kerghan/config` like `up` (so a broken config fails it), and
  does not touch the instance: the only Docker call is the read-only volume check when the file is
  missing.

#### `configure` and `wizard`

The two commands that change the settings without hand-editing the files:

- `kerghan configure` lists every value of `~/.kerghan/config` and `~/.kerghan/kerghan.env`
  (secrets masked unless `--show-secrets`), prints one (`kerghan configure KEY`, the scripting
  interface), or sets and unsets several in one all-or-nothing call
  (`kerghan configure port=3002 FRONTEND_BASE_URL=https://kerghan.example.com`, `--unset KEY`,
  `KEY=-` to read a value hidden). The key's case picks the file: lower-case keys go to `config`,
  upper-case keys to `kerghan.env`.
- `kerghan wizard` asks one question per setting (`--advanced` asks them all), with the current
  value as the default, then shows the changes and asks for confirmation before writing.

Both are write-only: they never start, stop or recreate the instance, and print the command
that applies the change (`kerghan up`, or `kerghan down && kerghan up`). The two secrets are
only changed by `kerghan configure --force`; the client-managed
`KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` / `KERGHAN_DEFAULT_USER_ALLOWED_IPS` / `KERGHAN_COOKIE_SECURE` are refused. Full
rules (key routing, write rules, edge cases, secret handling, exit codes, required tests):
[Client config](client-config.md). Both also handle `restart-on-update` (the wizard
always asks it, right after `bind`); changing only that key prints
`Takes effect on the next 'kerghan update'.` instead of a restart command.

#### `update`

`kerghan update [VERSION]` updates the client and the image together, to `VERSION` or the latest
release:

- It downloads the release's `install.sh` once (HTTPS only, to a private temp folder, never
  piped into `bash`), reads the target version from its stamp line, and compares it with the
  running client: already there is a no-op (`--force` reinstalls), and an older `VERSION` is a
  downgrade that needs a confirmation (`--yes`) and never restarts the instance.
- It runs that installer into the directory of the running client (symlinks resolved, never
  `sudo`), then hands off to the new client with `update --finish` (hidden), which adds missing
  `kerghan.env` variables, pulls the image and decides on the restart.
- The restart of a running instance follows `restart-on-update` (`ask`, `always` or `never`),
  overridden for one run by `--restart` / `--no-restart`. A stopped instance is never started.
- There is no rollback: when the pull or the restart fails, the client stays updated and the
  error says how to recover. A hint prints the `docker image rm` command for the previous image.

The handoff, the installer interface and the release files are stable contracts between client
versions. Full rules (flow, versions, downgrades, the setting, security, exit codes, stable
contracts, required tests): [Client update](client-update.md).

#### `completion`

`kerghan completion bash` prints a static bash completion script on stdout; `bash` is the only
supported shell. It completes commands, flags, `configure` keys and the fixed values of
`variant`, `runtime`, `auto-login` and `restart-on-update`, never free-form values, versions,
passthrough arguments or filenames, and runs no subprocess on TAB. `install.sh` installs it into
the bash-completion user directory, so it lazy-loads on the first `kerghan <TAB>`; without the
`bash-completion` package, load it with `eval "$(kerghan completion bash)"`. Opt out of the
installer step with `KERGHAN_COMPLETION=false`. Full rules (command, what is completed,
installer setup, security, stable contracts, testing, required tests):
[Client completion](client-completion.md).

**Sync rule:** a PR that adds or changes a client command, flag, `configure` key or fixed value
updates the completion in the same PR (see
[Definition of Done for PRs](../contributing.md#definition-of-done-for-prs));
`standalone/test/completion_sync.bats` enforces it.

### `FRONTEND_BASE_URL`

`up` passes `FRONTEND_BASE_URL=http://localhost:<port>` (the effective port) unless
`kerghan.env` sets `FRONTEND_BASE_URL` itself. See
[Same origin and `OriginGuard`](inner-stack.md#same-origin-and-originguard) for why.

### `up`: start, no-op or recreate

When the instance is already running, `up` compares the running image and port with the wanted
ones (from the flags, the config and the defaults):

- Same image and port: nothing to do (`Kerghan is already running at ...`).
- An older image (upgrade), the other variant, or another port: the instance is recreated, and the
  data volume is kept.
- A newer image: the downgrade warning above, and no change.
- A non-semver tag (for example `image-tag=latest`): the version comparison and the downgrade
  guard are skipped; `up` only checks that the running image reference and port match, and
  recreates otherwise.
- Same image and port, but a changed `auto-login` (read from the running container's
  `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`, missing counts as `false`, an inspect failure always
  recreates) or `bind` (the published host IP, empty counts as `0.0.0.0`): the instance is
  recreated, and the data volume is kept.
- Same image, port, auto-login and bind, but a changed cookie setting (read from the running
  container's `KERGHAN_COOKIE_SECURE`, missing counts as `true`, an inspect failure always
  recreates): recreated with the reason `allowing login over plain HTTP on loopback` (to `false`),
  `allowing login over plain HTTP on loopback hosts` (to `loopback`) or `requiring HTTPS for the session cookies` (to `true`), data volume kept. An instance created
  by a client before this setting is therefore recreated on its next `kerghan up` on loopback.

A changed `runtime` or `stop-timeout` never triggers a recreation; it applies the next time the
container is created (`kerghan down && kerghan up` applies it now).

### Other behavior

- **Port in use:** Vault's error is shown, with the hint
  `use 'kerghan up -p <port>' or set port= in ~/.kerghan/config to pick another port`.
- **Port-in-use check before start:** right before a new container is created
  (`warn_port_conflict`, called in `cmd_up` before `up_instance`; never when the instance is
  already running with the same settings), `up` looks for another process listening on the port
  on this host. If it finds one it warns on stderr, and never fails or stops `up`:
  - `port <port> is already in use by <process> (<addresses>)` (`another process` when the name is
    unknown);
  - `Kerghan is published on <bind>:<port> only; other addresses (such as localhost) may reach that
    process instead`;
  - the `-p` hint above;
  - on port 5000 or 7000 with `ControlCenter`, the AirPlay Receiver hint (see
    [the macOS AirPlay caveat](release-and-caveats.md#caveats)).

  It is skipped silently when neither `lsof` nor `ss` is available, or when `DOCKER_HOST` is
  `tcp://` or `ssh://` (a remote engine).
- **`port_listeners <port>`:** the helper behind that check, shared with `kerghan diagnose` (#597).
  It prints one `<address><TAB><process>` line per distinct listener (`*:5000`, `[::1]:5000`; the
  process is empty when unknown) using `lsof +c 0` or else `ss`. Exit `0` means a tool ran (no
  output: no listener); exit `2` means skipped (no tool). Keep this format stable.
- **`reset`:** asks `Continue? [y/N]` (default no), then stops the instance and removes
  `vault-kerghan-data`. It keeps `kerghan.env`.
- **`status` / `logs`:** the way to see a failed migration or an unhealthy service.

