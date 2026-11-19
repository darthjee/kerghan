# Security

Part of [Standalone: client update](../client-update.md). This page records the trust model and safe handling of downloads, temporary files, paths, secrets and downgrades.

## Trust model

`update` trusts the same source as first install: the `darthjee/kerghan` GitHub release over HTTPS. It does not verify checksums or signatures; a checksum from the same compromised release would not establish authenticity. Signature verification is possible future hardening, not part of this feature.

The client uses curl with HTTPS-only protocol and redirect restrictions (`--proto '=https' --proto-redir '=https'`). It downloads the installer to a file, checks the response and version stamp, then runs `"$BASH" <file>`; the installer is never piped into bash or sourced. The stamp is read as text, never evaluated. `VERSION` is strict `x.y.z` with one optional leading `v` removed, so URL/environment values cannot contain separators, metacharacters, spaces or newlines. See [version resolution](versions.md#resolve-through-the-installer-stamp).

## Temporary files

Each run creates a private unpredictable staging directory with `mktemp -d` under `TMPDIR`. An EXIT trap (also covering INT and TERM) removes it on failures and Ctrl-C. Before handoff `exec`, the old client removes the directory explicitly because the replaced process cannot run its trap. The below-`FIRST_UPDATE_VERSION` path does not exec and uses the trap. The installer uses and cleans its own staging directory.

## Exact-path execution

The client resolves `BASH_SOURCE[0]` through symlinks, then canonicalizes the real directory using a subshell with `CDPATH='' cd -P -- ...`. This makes a symlink invocation update the actual file while preserving the link. `KERGHAN_INSTALL_DIR` is that real directory. The installer always writes `<install dir>/kerghan`, so a real executable with another basename is refused before download. A path resolution failure (such as a symlink loop) is also refused.

The handoff executes exactly `<install dir>/kerghan update --finish`, never a PATH lookup. The new client validates handoff values before printing or acting on them; see [stable handoff contracts](contracts.md#handoff-interface).

## No sudo, credentials or new destinations

`update` never uses sudo or requests privileges. It refuses an unwritable install directory before download; the installer repeats the writable-directory check to cover races. It uses no GitHub API, token or credentials. Network destinations remain GitHub/release asset redirects and the Docker registry already used by the image pull.

## Secrets and env file

No `kerghan.env` values are printed or passed through the handoff. The new client reads the file itself. Its env update reuses `update-env`: append missing keys only, preserve existing values byte-for-byte, maintain mode `600`, and write atomically with `write_file_atomic`, leaving the prior file intact on write failure. Output names added keys only and may print the existing pointer to where a generated admin password is stored.

## Downgrade risk

Older versions may include vulnerabilities fixed later, so downgrade requires explicit confirmation or `--yes`. A downgrade never automatically opens newer instance data with an older image; the user must switch the instance manually with `kerghan down && kerghan up`. The MySQL 8.4.11 migration makes downgrades below that release unsupported; see [versions and downgrades](versions.md#downgrade).

## Required security tests

In `standalone/test/update.bats`:

- Known secret values never appear in stdout or stderr, including when env keys are added.
- Staging is removed on success before exec, all failure paths, declined downgrade and INT.
- Installer is run as `"$BASH" <file>`; the served stub records its staging-file `$0` and verifies stdin is not the script; curl uses `-f` and HTTPS-only options.
- Version metacharacters and newline are rejected before curl.
- Absolute and relative symlink invocation passes canonical `KERGHAN_INSTALL_DIR`, executes the real file, and leaves symlink in place.
- A real client basename other than `kerghan` fails before download; a PATH-shadowing `kerghan` does not intercept handoff.
- Env writes preserve mode `600` and existing lines.
