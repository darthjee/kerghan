# Installer and release assets

Read by #346. See the [README](README.md) for the feature overview,
[client.md](client.md) for the client, and [images.md](images.md) for the CI order.

## One-liner

```bash
curl -fsSL https://github.com/darthjee/kerghan/releases/latest/download/install.sh | bash
```

## Behavior

`standalone/install.sh`:

1. Checks the OS is Linux or macOS.
2. Checks Docker is installed and the daemon is reachable by the current user.
3. Never uses `sudo`.
4. Downloads the `kerghan` client for the requested version and installs it to `~/.local/bin`
   (or `KERGHAN_INSTALL_DIR`), executable. Warns, with the line to add, when that directory is
   not on `PATH`.
5. Installs the `vault` CLI when it is missing, through Vault's own `install.sh`, with
   `VAULT_VERSION` pinned to the Vault version the standalone image is built on (`0.1.0`, the
   tag in `FROM darthjee/vault:<v>`). darthjee/vault releases carry no assets, so the Vault
   installer is downloaded (to a file, never piped into `bash`) from
   `https://raw.githubusercontent.com/darthjee/vault/<VAULT_VERSION>/install.sh`. An existing
   `vault` is left alone.

The client is downloaded from
`https://github.com/darthjee/kerghan/releases/download/<version>/kerghan`.

| Variable | Effect | Default |
|---|---|---|
| `KERGHAN_VERSION` | Release to install. | the version stamped in `install.sh` by `scripts/bump_version.sh` |
| `KERGHAN_INSTALL_DIR` | Directory the client is installed to. | `~/.local/bin` |

Running it again upgrades the client in place. It never touches `~/.kerghan/` or the data volume.

## Errors

Each exits 1 with a clear message, and leaves no partial install:

- Docker missing or the daemon unreachable.
- The install directory cannot be created or is not writable.
- A download fails.
- An unsupported OS.

## Release assets

Uploaded to the GitHub release of each semver tag by the CircleCI job `release-kerghan-assets`,
after `release-kerghan-standalone` (see [images.md](images.md#when-and-in-which-order)). The job
authenticates `gh` with the `GITHUB_TOKEN` project variable, creates the release when it is
missing, and uploads with `gh release upload --clobber`, so a rerun replaces the assets:

| Asset | Content |
|---|---|
| `kerghan` | The client, with its image version pinned to the release tag. |
| `install.sh` | The installer. |
| `config.example` | The commented example of `~/.kerghan/config`, from `standalone/config.example` (see [config.md](config.md#example)). |
| `SHA256SUMS` | SHA-256 checksums of the three files above, with bare basenames. |

Verification, documented for users: download the assets and run
`sha256sum -c --ignore-missing SHA256SUMS` (Linux) or
`shasum -a 256 -c --ignore-missing SHA256SUMS` (macOS). `--ignore-missing` lets the check pass
when only some assets (for example only `install.sh`) were downloaded.

No example env file is shipped: the pass-through variables users can add to
`~/.kerghan/kerghan.env` are documented in the "Standalone" section of `environment-variables.md`
(see [variables.md](variables.md#shipped-documentation)).

## Required tests

- Each error path exits 1 with its message.
- Installing into a custom `KERGHAN_INSTALL_DIR`, and the `PATH` warning.
- `vault` is installed only when missing, and with the pinned version.
- A rerun upgrades in place.
- `KERGHAN_VERSION` installs that release.
- The uploaded `kerghan` pins the release's image version, and `SHA256SUMS` matches the uploaded
  files.
