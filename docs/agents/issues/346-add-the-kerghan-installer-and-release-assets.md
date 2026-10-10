# Issue: Add the kerghan installer and release assets

## Description

Part of epic #336. A one-line installer for the `kerghan` client CLI (`standalone/bin/kerghan`,
#344/#345), and the GitHub release assets that back it.

```bash
curl -fsSL https://github.com/darthjee/kerghan/releases/latest/download/install.sh | bash
```

Depends on #343 (release `darthjee/kerghan-standalone`) and #344 (the `kerghan` CLI).

**Owner:** standalone (installer, tests) and infra (CircleCI release job).

## Solution

### Installer (`standalone/install.sh`)

- Self-contained (works through `curl | bash`), bash 3.2 compatible, never uses `sudo`;
  everything runs from a `main` called on the last line, so a truncated download runs nothing
  (same shape as the `darthjee/vault` installer).
- Checks that Docker is installed and its daemon reachable.
- Version: `KERGHAN_VERSION` is stamped in `install.sh` by `scripts/bump_version.sh` (like the
  CLI), so the installer from release `<v>` installs `<v>`. Setting `KERGHAN_VERSION` overrides
  it. The CLI is downloaded from `releases/download/<v>/kerghan`.
- Installs `kerghan` to `~/.local/bin` (override: `KERGHAN_INSTALL_DIR`) and warns (with the
  line to add) if it is not on `PATH`.
- Running it again upgrades in place.
- Installs the `vault` CLI when it is missing, by running the Vault installer fetched from
  `https://raw.githubusercontent.com/darthjee/vault/<VAULT_VERSION>/install.sh` with
  `VAULT_VERSION=<pinned>`. The pinned version matches the image the standalone image is built
  on (currently `0.1.0`, from `FROM darthjee/vault:0.1.0`). darthjee/vault releases carry no
  assets, so the raw file at the tag is used.
- Does not touch `~/.kerghan` (the CLI creates it, and `~/.kerghan/config` is optional).
- Clear errors (exit 1) for: Docker missing or unreachable, install dir not writable, download
  failure (including the Vault installer). Linux and macOS only.

### Release assets

A CircleCI job on each semver tag, after `release-kerghan-standalone`, publishes to the GitHub
release for the tag:

- Authenticates with a new `GITHUB_TOKEN` CircleCI environment variable (documented with the
  other CI env vars).
- Creates the GitHub release for the tag if it does not exist yet, then uploads with
  `gh release upload --clobber` (so a re-run is safe).
- Assets:
  - `kerghan` (its `KERGHAN_VERSION` is already pinned by `scripts/bump_version.sh`);
  - `install.sh`;
  - `config.example` (the example `~/.kerghan/config`, uploaded only, not installed). It
    replaces the `kerghan.env.example` of the original epic plan: #345 moved settings to
    `~/.kerghan/config`, and the CLI generates the secrets env file itself;
  - `SHA256SUMS` (of the files above).

Document how to verify the installer with `SHA256SUMS` before running it.

### Tests

Bats tests for the installer under `standalone/test/` (run by the existing `standalone_tests`
job), with `docker`, `curl` and the Vault installer stubbed.
