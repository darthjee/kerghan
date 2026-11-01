# Client update

Temporary feature specs for the **`kerghan update` client command and its `restart-on-update`
setting**, which update the standalone client and its image together. Product decision: #414.
Lifecycle and conventions: [Feature Specs](../../specs.md).

## Overview

Today, upgrading a standalone installation takes two manual steps: re-run the installer
(`install.sh`, which replaces the client in place), then run `kerghan up`, which sees that the
running container is older than the image the client pins (`KERGHAN_VERSION`) and recreates it
on the new image, keeping the data volume.

`kerghan update [VERSION]` does both in one command:

1. **Resolve** the target version: `VERSION` when given, otherwise the latest release. Both
   come from the release's own `install.sh` (see [versions.md](versions.md)).
2. **Compare** it with the running client: a no-op when already there (unless `--force`), and
   a warning plus a confirmation for a downgrade (see [versions.md](versions.md)).
3. **Install** it by running that same downloaded `install.sh` into the directory of the
   running client (see [command.md](command.md#3-install) and
   [contracts.md](contracts.md#installer-interface)).
4. **Hand off** to the new client (`exec <install dir>/kerghan update --finish`), so only the
   new code decides how the new version works (see
   [contracts.md](contracts.md#handoff-interface)).
5. **Finish**, in the new client: add missing `kerghan.env` variables, pull the image, restart
   a running instance according to `restart-on-update` (or `--restart` / `--no-restart`), and
   print the result and the cleanup hint (see [command.md](command.md#5-finish)).

The new setting, `restart-on-update=ask|always|never` (default `ask`), is defined in
[setting.md](setting.md).

## Scope

In scope:

- **`kerghan update [VERSION] [--force] [--yes] [--[no-]restart]`**: resolution, comparison,
  install, handoff, env update, pull, restart and hints ([command.md](command.md),
  [versions.md](versions.md)).
- **The hidden `update --finish` step** and the stable contracts between client versions: the
  handoff, the installer and the release files ([contracts.md](contracts.md)).
- **The `restart-on-update` setting**: parser, `kerghan configure`, `kerghan wizard`, the usage
  text and the `config.example` entry ([setting.md](setting.md)).
- **The trust model and safe execution** of the download and the handoff
  ([security.md](security.md)).

Out of scope (from #414):

- Automatic or background update checks, and "new version available" notices.
- Updating the `vault` CLI: `install.sh` installs it only when it is missing, at its pinned
  `VAULT_VERSION`.
- Checksum or signature verification of the downloads (see
  [security.md](security.md#trust-model)).
- Automatic pruning of old images: a hint prints the `docker image rm` command instead.
- Rollback of any kind, and data or schema migration beyond what `kerghan up` already does.
- Concurrent `update` runs.
- Any change to `install.sh` (see
  [contracts.md](contracts.md#no-installer-addition-is-needed)).

## Behaviour decisions

- **Client and image always move together.** There is no client-only or image-only mode: the
  client pins its image.
- **Already on the target version:** a no-op that prints `kerghan <v> is already up to date.`;
  `--force` reinstalls anyway.
- **Downgrade:** only with an explicit `VERSION`, after a warning and a `[y/N]` confirmation;
  `--yes` skips the confirmation and is required without a TTY. A downgrade never restarts the
  instance: it prints how to switch it by hand (see
  [versions.md](versions.md#downgrade)).
- **Downgrade below the first version that ships `update`:** allowed. Only the client is
  replaced; the user switches the instance by hand (see
  [versions.md](versions.md#downgrade-below-first_update_version)).
- **Restart only applies to a running instance.** A stopped instance is never started; a hint
  suggests `kerghan up`.
- **No rollback.** When the pull or the restart fails, the client stays updated and the error
  says how to recover.
- **`image-tag` override kept**, with a warning that it still overrides the pinned version.
- **No installer change.** `update` relies only on the installer contract that already
  shipped, so no installer sub-issue is needed (see
  [contracts.md](contracts.md#no-installer-addition-is-needed)).

## Exit codes and streams

Shared by every path, following the client's existing conventions:

| Case | Exit |
|------|------|
| Success, including the no-op, "newer than the latest release" and a skipped restart | `0` |
| Usage error (unknown option, invalid `VERSION`, two `VERSION`s, `--restart` with `--no-restart`) — prints usage | `2` |
| Failure or refusal (download, stamp, installer, handoff, pull, declined or unconfirmed downgrade) | `1` |
| Restart failure | the exit status of `up`'s restart (non-zero) |
| Ctrl-C | `130` |

Streams:

- **stdout:** progress and result lines (`Updating kerghan …`, `kerghan updated … -> …`), the
  installer's own `kerghan-install:` lines and the `docker pull` progress.
- **stderr:** errors, warnings and hints, through the client's `error` / `warn` / `hint`
  helpers (`kerghan: error: …`, `kerghan: warning: …`, `kerghan: hint: …`); usage errors
  through `usage_error`; and the two prompts (the downgrade confirmation and
  `Restart Kerghan now? [Y/n]`), like the `reset` confirmation.

## Alternatives rejected

- **Resolving the latest version through the GitHub API:** rejected; the
  `releases/latest/download/install.sh` redirect needs no API call and no credentials, and the
  same download is reused for the install.
- **Adding a "print the version" mode to `install.sh`:** unnecessary, since the stamp line
  already carries the version, and impossible to rely on for downgrades, which run older
  installers.
- **Refusing downgrades below the first version that ships `update`:** rejected in favour of
  replacing the client and telling the user how to switch the instance.
- **Doing the pull and restart in the old client:** rejected; only the new client knows its
  pinned version, image naming and config keys.
- **Passing the handoff context as arguments:** rejected in favour of environment variables,
  which an older client can ignore without failing (see
  [contracts.md](contracts.md#handoff-interface)).

## Sub-issue map

| Issue | Builds | Reads |
|---|---|---|
| #415 | These specs | — |
| #416 | The `restart-on-update` setting: parser, `configure`, `wizard`, usage, `config.example` | [setting.md](setting.md) |
| #417 | `kerghan update [VERSION]` and `update --finish` | [command.md](command.md), [versions.md](versions.md), [contracts.md](contracts.md), [security.md](security.md) |
| #418 | Fold these specs into the permanent docs and delete this folder | all |

## Index

| File | Defines |
|---|---|
| [command.md](command.md) | `kerghan update`: usage synopsis and options, argument parsing, the flow (resolve → compare → install → handoff → finish), env step, pull, restart decision, result and cleanup hints, instance state, failures, messages |
| [versions.md](versions.md) | `VERSION` validation, resolution through the installer stamp line, comparison (no-op, `--force`, newer than the latest release, non-release client), downgrade warning and confirmation, `FIRST_UPDATE_VERSION` |
| [setting.md](setting.md) | `restart-on-update`: values, default, parser, `configure`, apply hint, wizard question, usage and `config.example` lines, older clients |
| [contracts.md](contracts.md) | Stable contracts: the `update --finish` handoff, the installer interface (and why no addition is needed), the release files, the first upgrade |
| [security.md](security.md) | Trust model, download to a file, temp files, strict `VERSION`, exact-path execution, symlinks, no sudo or credentials, secrets, downgrade risk |

## Required tests

Exit codes and streams are tested from the "Required tests" section of
[command.md](command.md#required-tests) and [versions.md](versions.md#required-tests). Every
other rule is tested from the file that defines it.
