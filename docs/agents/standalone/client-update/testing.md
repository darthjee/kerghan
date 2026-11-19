# Testing client update

Part of [Standalone: client update](../client-update.md). This page gathers the cross-cutting test conventions and acceptance matrix for update, version resolution, restart configuration, security and stable interfaces.

## Exit codes and streams

| Case | Exit |
|------|------|
| Success, no-op, newer-than-latest result, skipped restart | `0` |
| Usage error; prints usage | `2` |
| Download, stamp, installer, handoff, pull failure or refused/declined downgrade | `1` |
| Restart failure | `up` restart status (non-zero) |
| Ctrl-C | `130` |

Progress/result lines, installer `kerghan-install:` output and Docker pull progress go to stdout. Errors, warnings, hints, usage errors and the downgrade/restart prompts go to stderr. Declined downgrade exits `1` so scripts can distinguish that no update occurred.

## Test harness

The main suite is `standalone/test/update.bats`; curl, installer, Vault and Docker use the existing `stubs/` convention. TTY scenarios are driven with `KERGHAN_ASSUME_TTY=true`. Related configuration coverage lives in `config.bats`, `configure.bats`, `configure_files.bats`, `wizard.bats`; installer stamp format is checked in `install.bats`.

## Command and finish matrix

`update.bats` should verify:

- Help synopsis and options block verbatim; hidden `--finish` is absent.
- Parsing errors exit `2` before curl; options work before/after VERSION.
- Invalid config, wrong real client basename, and non-writable install directory fail before download.
- Full update order: progress, installer, handoff, env update, correct image pull, restart decision, result.
- Equal image with `--force` has no prompt/restart; env-key additions trigger the apply hint only when needed.
- Missing env with an existing volume warns/restores and skips restart.
- Pull uses offline variant and `image-tag` override correctly; pull failure exits `1`, hints at retry, and does not restart.
- Installer failure leaves client unchanged; handoff failure hints that client may already be updated; restart failure includes `up` hints and returns its status.
- Result text and old image cleanup hints vary correctly for updated, reinstalled, hand-run finish, restarted/not restarted, stopped instance, unchanged image and downgrade.
- No-op stays cheap: one curl and no Docker call.

## Version and downgrade matrix

See [versions](versions.md#required-version-tests). In brief: strict semver acceptance/rejection; latest vs explicit installer URLs; 404/network/stamp failures; no-op/force/newer-than-latest/non-release cases; TTY yes/no/Enter/EOF and no-TTY downgrade confirmations; downgrade warning lines and restart suppression; below-first-version client-only replacement.

## Restart configuration matrix

See [restart configuration](restart.md#required-tests). Cover parser, configure read/set/unset/listing, apply hint precedence, wizard prompt ordering and validation, help/config-example output, and all restart policies crossed with running/stopped state and `--restart` / `--no-restart` overrides. Stopped instances never prompt or start.

## Security and stable-contract matrix

See [security tests](security.md#required-security-tests) and [stable contract tests](contracts.md#required-contract-tests). Verify secret exclusion, staging cleanup (including INT), never-piped install, curl protocol restrictions, metacharacter rejection, symlink canonicalization, exact handoff path, no PATH shadowing, env-file permissions, explicit handoff environment, finish fallbacks, installer stamp and update environment.
