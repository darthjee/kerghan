# Standalone Plan: Client: `kerghan update [VERSION]`

Main plan: [plan.md](plan.md)

## Overview

Add the `update` command to `standalone/bin/kerghan`: the old client checks preconditions,
resolves the target version from the release's `install.sh` stamp line, compares versions
(no-op / reinstall / newer-than-latest / non-release / upgrade / downgrade), runs the installer
into its own real directory, then `exec`s the new client's hidden `update --finish`, which adds
missing `kerghan.env` keys, pulls the image, decides on the restart and prints the result and
cleanup hints. No installer, Docker image or CI change.

## Context

- **Source of truth:** `docs/agents/specs/client-update/` —
  [command.md](../../specs/client-update/command.md) (usage, parsing, flow, finish, restart
  decision, hints, exit codes), [versions.md](../../specs/client-update/versions.md)
  (validation, resolution, comparison, downgrade, `FIRST_UPDATE_VERSION`),
  [contracts.md](../../specs/client-update/contracts.md) (handoff env vars and rules, installer
  interface), [security.md](../../specs/client-update/security.md) (staging folder, exact-path
  execution, no sudo, secrets) and the README's exit-code/stream table. Every message string
  and exit code must be copied from there verbatim; this plan does not restate them.
- `restart-on-update` (parser, `DEFAULT_RESTART_ON_UPDATE`, `valid_restart_on_update`,
  `setting_lookup`) already shipped with #416.
- Reusable helpers already in the client: `load_config`, `usage_error`, `error`/`warn`/`hint`,
  `is_semver`, `version_compare`, `is_tty` (honours `KERGHAN_ASSUME_TTY`), `resolve_symlink`,
  `write_file_atomic`, `default_env_lines`, `env_file_has_key`, `env_file_sets`,
  `volume_exists`, `running_image`, `image_ref`, `cmd_up`, `recreate_reason`; the `reset`
  prompt pattern (`read -r answer || true`, lower-cased `case`).
- `FIRST_UPDATE_VERSION="0.8.3"` (issue decision): any value above `0.8.2` and no higher than
  the release that ships `update` is equivalent, since no release exists in between; no
  pre-release check.
- Must stay bash 3.2 compatible (macOS), like the rest of the client.

## Steps

- [01 — Usage, dispatcher, constants and argument parsing](standalone/01-usage-dispatcher-parsing.md)
- [02 — Extract the shared missing-env-keys helper](standalone/02-extract-env-helper.md)
- [03 — Preconditions, resolution and comparison (old client)](standalone/03-preconditions-resolve-compare.md)
- [04 — Install and hand off (old client)](standalone/04-install-and-handoff.md)
- [05 — `update --finish` (new client)](standalone/05-update-finish.md)
- [06 — `update.bats` and stub extensions](standalone/06-tests.md)

## CI Checks

- `standalone`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`, runs
  `bats standalone/test`)
- Shell lint/format checks already applied to `standalone/bin/kerghan` in CI must stay green
  (shellcheck directives follow the file's existing style).

## Notes

- `update_env.bats` must pass unchanged after step 02 — it is the guard that
  `cmd_update_env`'s output did not drift.
- Tests must never hit the network or real Docker: the `curl`, `docker`, `vault` stubs and a
  stubbed installer (served by the `curl` stub) cover everything; the handoff `exec` target is a
  real copy of the client written by the fake installer, so the finish step is exercised
  end-to-end.
- The first upgrade from ≤0.8.2 is still manual; documenting that is #418, not this issue.
