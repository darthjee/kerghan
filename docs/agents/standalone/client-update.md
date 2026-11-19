# Standalone: client update (`kerghan update` / `restart-on-update`)

Part of [Standalone Distribution](../standalone.md). This guide defines how the standalone client and image are updated together, how the hidden handoff finishes an update, and which values and interfaces must remain stable across releases.

## Guides

- [Command and update flow](client-update/command.md) — `kerghan update [VERSION]`, options, parsing, preconditions, resolve/install/handoff/finish steps, progress and result lines, and required command tests.
- [Versions and downgrades](client-update/versions.md) — strict version validation, installer stamp resolution, comparison cases, no-op and downgrade behavior, `FIRST_UPDATE_VERSION`, and version test matrices.
- [Restart configuration](client-update/restart.md) — `restart-on-update=ask|always|never`, restart decisions, `configure`, wizard, usage/config examples, and older-client behavior.
- [Security](client-update/security.md) — trust model, HTTPS downloads, staging files, exact-path execution, secrets, downgrade risk, and security tests.
- [Stable contracts](client-update/contracts.md) — handoff environment variables, installer interface, release assets, hidden finish step, and backward-compatibility rules.
- [Testing](client-update/testing.md) — shared exit-code and stream rules, test locations, required update matrices, failures, and stub conventions.

## Summary

Without `update`, upgrading requires rerunning `install.sh` and then `kerghan up`. `kerghan update [VERSION]` resolves the target, compares it with the installed client, runs the release installer, hands off to the new client, adds missing environment keys, pulls the pinned image, and restarts a running instance according to configuration.

The flow has five stages:

1. resolve the target from the release installer stamp;
2. compare it with the installed client and confirm explicit downgrades;
3. run the downloaded installer into the real install directory;
4. hand off to the installed client through `update --finish`; and
5. finish environment, pull, restart, result and cleanup work in the new client.

Key behavior decisions:

- the client and image always move together;
- the default target is the latest release;
- an explicit downgrade requires confirmation unless `--yes` is used;
- downgrades never restart a running instance automatically;
- stopped instances are never started by `update`;
- pull or restart failures leave the client updated with no rollback;
- `restart-on-update` defaults to `ask`, and per-run flags override it for that run;
- `update --finish` is hidden and is stable across future clients.

## Exit codes and streams

- exit `0`: success, no-op, newer-than-latest result, and skipped restart;
- exit `1`: download, stamp, installer, handoff, pull, refusal or declined downgrade failure; restart failure uses `up`'s exit status;
- exit `2`: usage errors;
- exit `130`: Ctrl-C.

Progress, installer output and Docker pull output go to stdout. Errors, warnings, hints and prompts go to stderr. Confirmations use the client’s existing prompt conventions.

## Related code and tests

Code lives in `standalone/bin/kerghan`, including `cmd_update`, `cmd_update_finish`, update helpers, config parsing, `configure`, and the wizard. The primary tests are `standalone/test/update.bats`, `config.bats`, `configure.bats`, `configure_files.bats`, `wizard.bats`, and `install.bats`.
