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
   `VAULT_VERSION` pinned to the Vault version the standalone image is built on (`0.1.0`). An
   existing `vault` is left alone.

| Variable | Effect | Default |
|---|---|---|
| `KERGHAN_VERSION` | Release to install. | latest release |
| `KERGHAN_INSTALL_DIR` | Directory the client is installed to. | `~/.local/bin` |

Running it again upgrades the client in place. It never touches `~/.kerghan/` or the data volume.

## Errors

Each exits 1 with a clear message, and leaves no partial install:

- Docker missing or the daemon unreachable.
- The install directory cannot be created or is not writable.
- A download fails.
- An unsupported OS.

## Release assets

Uploaded to the GitHub release of each semver tag by a CircleCI job (`gh release upload`), after
`release-kerghan-standalone` (see [images.md](images.md#when-and-in-which-order)):

| Asset | Content |
|---|---|
| `kerghan` | The client, with its image version pinned to the release tag. |
| `install.sh` | The installer. |
| `kerghan.env.example` | The example env file (see [variables.md](variables.md#shipped-documentation)). |
| `SHA256SUMS` | SHA-256 checksums of the three files above. |

Verification, documented for users: download the assets and run `sha256sum -c SHA256SUMS`
(Linux) or `shasum -a 256 -c SHA256SUMS` (macOS).

## Required tests

- Each error path exits 1 with its message.
- Installing into a custom `KERGHAN_INSTALL_DIR`, and the `PATH` warning.
- `vault` is installed only when missing, and with the pinned version.
- A rerun upgrades in place.
- `KERGHAN_VERSION` installs that release.
- The uploaded `kerghan` pins the release's image version, and `SHA256SUMS` matches the uploaded
  files.
