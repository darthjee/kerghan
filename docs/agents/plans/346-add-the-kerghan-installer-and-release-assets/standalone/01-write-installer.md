# Write the installer

Create `standalone/install.sh` (executable), modeled on the `darthjee/vault` installer
(`https://raw.githubusercontent.com/darthjee/vault/0.1.0/install.sh`):

- `#!/usr/bin/env bash` and `set -euo pipefail`. Self-contained: it sources nothing, because it is
  fetched with `curl | bash`. All work runs from `main`, which is called on the last line, so a
  truncated download runs nothing. Bash 3.2 compatible. Never calls `sudo`.
- Header comment: usage (the one-liner), the variables (`KERGHAN_VERSION`,
  `KERGHAN_INSTALL_DIR`) and how to verify the installer with `SHA256SUMS` first (download
  `install.sh` + `SHA256SUMS`, then `sha256sum -c --ignore-missing SHA256SUMS` on Linux or
  `shasum -a 256 -c --ignore-missing SHA256SUMS` on macOS, then `bash install.sh`).
- Version: `requested_version="${KERGHAN_VERSION:-}"`, then the stamp line
  `KERGHAN_VERSION="0.5.0"` (current version, matching `standalone/bin/kerghan`), then
  `version="${requested_version:-$KERGHAN_VERSION}"`. Also `VAULT_VERSION="0.1.0"` (not
  overridable; comment that it must match the Dockerfile's `FROM darthjee/vault:<v>`).
- `install_dir="${KERGHAN_INSTALL_DIR:-$HOME/.local/bin}"`.
- `main` order:
  1. `check_os`: `uname -s` must be `Linux` or `Darwin`. Otherwise error "unsupported OS:
     <name>" and exit 1.
  2. `check_docker`: `docker` on PATH (else "docker not found in PATH") and `docker info`
     succeeds (else "cannot reach the Docker daemon" plus a hint).
  3. `check_dir`: `mkdir -p` the install dir. It must be a writable directory, else
     "<dir> is not writable".
  4. Create a staging dir with `mktemp -d`; `trap` removes it on EXIT.
  5. `fetch_client`: `curl -fsSL -o "$staging/kerghan" <client URL>`. On failure, error
     "failed to download kerghan <version> from <url>" and exit 1. `chmod +x`.
  6. `ensure_vault`: if `command -v vault` succeeds, leave it alone. Otherwise download the
     Vault installer to `$staging/vault-install.sh` (on failure, error "failed to download the
     Vault installer from <url>", exit 1). Run it with
     `VAULT_VERSION="$VAULT_VERSION" bash "$staging/vault-install.sh"`. If it exits non-zero,
     error "the Vault installer failed" and exit 1. Download to a file, never `curl | bash`, so
     a failed download is detected.
  7. `move_client`: `mv -f "$staging/kerghan" "$install_dir/kerghan"`. This overwrites the
     previous client, so a rerun upgrades in place. It is the only write to the install dir, so
     a failure before it leaves no partial install.
  8. Report "kerghan <version> installed to <dir>/kerghan".
  9. `check_path`: if the install dir is not on `PATH`, warn and print the line to add, e.g.
     `export PATH="<dir>:$PATH"`.
- Never touches `~/.kerghan/` or any Docker volume.
- Errors go to stderr with an `error:` prefix and exit 1. Hints use a `hint:` prefix, following
  `standalone/bin/kerghan`'s style.

## Files to Change

- `standalone/install.sh` — new installer (mode 755).
