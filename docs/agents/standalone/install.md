# Standalone: install and upgrade

Part of [Standalone Distribution](../standalone.md). Requirements, installing the client, verifying the release assets and upgrading.

## Requirements

- A Linux or macOS host. Windows and rootless Docker are not supported.
- Docker, with the [Sysbox](https://github.com/nestybox/sysbox) runtime or `--privileged`
  containers allowed. The daemon must be reachable by the current user. On Linux, Docker Engine
  28.0 or later is required for the loopback-only default `bind` to hold (see
  [Caveats](release-and-caveats.md#caveats)).
- For the client: `vault`, `docker` and `openssl` on the host, and bash 3.2 or later. The
  installer installs `vault` when it is missing.

## Install and upgrade

### Installing the client

```bash
curl -fsSL https://github.com/darthjee/kerghan/releases/latest/download/install.sh | bash
```

`install.sh`:

1. Checks the OS is Linux or macOS.
2. Checks Docker is installed and the daemon is reachable.
3. Downloads the `kerghan` client of the requested version from
   `https://github.com/darthjee/kerghan/releases/download/<version>/kerghan` and installs it,
   executable, into the install directory. When that directory is not on `PATH`, it prints a
   warning with the `export PATH=...` line to add.
4. Installs the `vault` CLI when it is not on `PATH`, through Vault's own installer, pinned to the
   Vault version the standalone image is built on (`VAULT_VERSION="0.4.0"`, matching
   `FROM darthjee/vault:0.4.0`). The Vault installer is downloaded to a file, never piped into
   `bash`. An existing `vault` is left alone.
5. Writes the bash completion file (the output of the just-installed
   `kerghan completion bash`) into the user-level bash-completion directory, unless
   `KERGHAN_COMPLETION=false`. This step never fails the install: a problem only prints a
   `warning:`. See [Client completion: Installer setup](client-completion.md#installer-setup).

It never uses `sudo` and never touches `~/.kerghan/` or any Docker volume.

| Variable | Effect | Default |
|---|---|---|
| `KERGHAN_VERSION` | Release to install. | The version stamped in `install.sh` by `scripts/bump_version.sh` |
| `KERGHAN_INSTALL_DIR` | Directory the client is installed to. | `~/.local/bin` |
| `KERGHAN_COMPLETION` | Set to `false` to skip installing bash completion. | unset (installed) |

For example: `curl -fsSL .../install.sh | KERGHAN_VERSION=0.5.0 bash`.

Each of these errors exits 1 with a message, and leaves no partial install: an unsupported OS,
Docker missing or its daemon unreachable, an install directory that cannot be created or is not
writable, and a failed download. The client is only moved into the install directory once every
download succeeded.

### Verifying the release assets

Each release carries a `SHA256SUMS` file (see
[architecture/infra.md](../architecture/infra/releases.md#release-kerghan-assets--client-assets-on-the-github-release)).
To check the installer before running it:

```bash
curl -fsSLO https://github.com/darthjee/kerghan/releases/download/<version>/install.sh
curl -fsSLO https://github.com/darthjee/kerghan/releases/download/<version>/SHA256SUMS
sha256sum -c --ignore-missing SHA256SUMS          # Linux
shasum -a 256 -c --ignore-missing SHA256SUMS      # macOS
bash install.sh
```

`--ignore-missing` lets the check pass when only some of the assets were downloaded.

### Upgrading

Run `kerghan update` (or `kerghan update VERSION` for a given release). The client and the image
always move together: it downloads the release's installer, replaces the client in place, then
hands off to the new client, which adds missing `kerghan.env` variables, pulls the new image
and, when the instance is running, restarts it according to `restart-on-update` (`ask` by
default; `--restart` / `--no-restart` override it for one run). A restart recreates the container
on the new image like `kerghan up`: the data volume is kept, and the backend runs the pending
migrations on boot. A stopped instance is never started. See [`update`](client.md#update) and
[Client update](client-update.md).

**First upgrade.** Clients older than `FIRST_UPDATE_VERSION` (0.8.2 and older) have no `update`.
To reach the first version that has it, upgrade by hand once:

1. Run the installer again. It replaces the client in place (with the latest release, or with
   `KERGHAN_VERSION`).
2. Run `kerghan up`. When the running instance uses an older image than the new client, the client
   recreates it (`down`, then `up`) with the new image. The data volume is kept, and the backend
   runs the pending migrations on boot. An installation whose `kerghan.env` predates the default
   user keeps automatic login off and the port on every interface (see [Secrets](client.md#secrets));
   `kerghan update-env` adds the missing keys. This manual path never modifies `kerghan.env` by
   itself.

From then on, `kerghan update` works.

**Downgrades.** `kerghan update VERSION` with an older `VERSION` downgrades the client (and pulls
its image) only after a warning and a `[y/N]` confirmation (`--yes` without a terminal), and it
never restarts the instance: it prints how to switch it by hand. Running an older image against
data a newer one wrote is not supported (an older image against a newer schema): when the running
instance uses a newer image than the client (or than `image-tag`), `kerghan up` prints a warning
and a hint, exits non-zero, and does not touch the instance.

