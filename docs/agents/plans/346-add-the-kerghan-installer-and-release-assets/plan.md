# Plan: Add the kerghan installer and release assets

Issue: [346-add-the-kerghan-installer-and-release-assets.md](../../issues/346-add-the-kerghan-installer-and-release-assets.md)

## Overview

Add `standalone/install.sh`, a self-contained `curl | bash` installer for the `kerghan` client.
It also installs the `vault` CLI when it is missing. Add a CircleCI job that publishes `kerghan`,
`install.sh`, `config.example` and `SHA256SUMS` to the GitHub release of each semver tag. The
`standalone` agent owns the installer, its bats tests and the standalone spec updates. The
`infra` agent owns the version stamping in `scripts/bump_version.sh`, the release-asset script,
the CircleCI job and the CI variable docs.

## Agents involved

- [standalone](standalone.md)
- [infra](infra.md)

## Shared contracts

- **Version stamp in `install.sh`**: one line matching `^KERGHAN_VERSION="[0-9.]*"$`, the same
  form as in `standalone/bin/kerghan`. The same `bump_version.sh` sed rewrites it. The user's
  override is read *before* that line, following the Vault installer:

  ```bash
  requested_version="${KERGHAN_VERSION:-}"
  KERGHAN_VERSION="0.5.0"
  version="${requested_version:-$KERGHAN_VERSION}"
  ```

- **Vault pin in `install.sh`**: `VAULT_VERSION="0.1.0"`. It must equal the tag in
  `FROM darthjee/vault:<v>` in `dockerfiles/kerghan_standalone/Dockerfile`, and a bats test
  checks this.
- **Download URLs** used by the installer:
  - client: `https://github.com/darthjee/kerghan/releases/download/<version>/kerghan`;
  - Vault installer: `https://raw.githubusercontent.com/darthjee/vault/<VAULT_VERSION>/install.sh`.
- **Release assets** (the exact basenames on the GitHub release for tag `<v>`):

  | Asset | Source |
  |---|---|
  | `kerghan` | `standalone/bin/kerghan` |
  | `install.sh` | `standalone/install.sh` |
  | `config.example` | `standalone/config.example` |
  | `SHA256SUMS` | `sha256sum kerghan install.sh config.example`, bare basenames, so `sha256sum -c SHA256SUMS` works in a folder holding the downloads |

  `kerghan.env.example` is no longer shipped.
- **CI**: a new job `release-kerghan-assets` (semver tags only) requires
  `release-kerghan-standalone`. It authenticates `gh` with a new CircleCI project variable
  `GITHUB_TOKEN` (a token with `contents: write` on `darthjee/kerghan`).
