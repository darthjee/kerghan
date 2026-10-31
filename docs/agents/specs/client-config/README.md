# Client config

Temporary feature specs for the **`kerghan configure` and `kerghan wizard` client commands**,
which read and write the standalone client's settings and secrets. Product decision: #402.
Lifecycle and conventions: [Feature Specs](../../specs.md).

## Overview

Today the only way to change a standalone installation's settings is to edit
`~/.kerghan/config` and `~/.kerghan/kerghan.env` by hand (or to pass flags to every
`kerghan up`). This feature adds two commands over both files:

- **`kerghan configure`** — direct and scriptable: list every value, read one, set one or more
  (`key=value`), or unset one. See [configure.md](configure.md).
- **`kerghan wizard`** — interactive: one question per setting, with the current value as the
  default, a summary and a confirmation before anything is written. See [wizard.md](wizard.md).

Both share one writer (key routing, validation, line editing, atomic writes), defined in
[files.md](files.md), and one set of secret-handling rules, defined in
[security.md](security.md).

## Scope

In scope:

- **Both files.** `~/.kerghan/config` holds the client settings, all lower-case keys: `port`,
  `variant`, `runtime`, `stop-timeout`, `image-tag`, `auto-login`, `bind`.
  `~/.kerghan/kerghan.env` holds the container's environment, all upper-case keys (the two
  secrets, the `KERGHAN_DEFAULT_USER_*` values, `FRONTEND_BASE_URL`, any custom variable).
- **Routing by key.** The two namespaces never collide, so the key alone decides which file is
  written (see [files.md](files.md#key-routing)). There is no `--env` flag.
- **Write-only.** The commands only write the files and print what changed (`key: old -> new`)
  followed by the apply hint (see [files.md](files.md#apply-hint)). They never run `kerghan up`,
  never start, stop or inspect containers; the only Docker call is the read-only volume check
  of [files.md](files.md#missing-files) case 3.
- **Nothing else changes.** Existing commands, flags and file formats keep their current
  behavior. Files written by these commands are read by `up`, `down`, `reset` and `update-env`
  exactly as hand-edited files are.

Out of scope:

- Running or recreating the instance (the user runs the printed apply hint).
- `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` and `KERGHAN_DEFAULT_USER_ALLOWED_IPS`: the client
  manages them itself on every `up` and keeps refusing them in `kerghan.env` (see
  [configure.md](configure.md#refused-keys)).
- A machine-readable listing (`--json`): scripts use the single read
  (`kerghan configure <key>`).
- Asking for the two secrets in the wizard.

## Exit codes and streams

Shared by both commands, following the client's existing conventions:

| Case | Exit |
|------|------|
| Success | `0` |
| Wizard summary answered `n` (prints `Nothing written.`) | `0` |
| Usage error (unknown option, malformed argument, `--unset` without a key) — prints usage | `2` |
| Refusal (invalid value, refused or unknown key, missing `kerghan.env` with a data volume, no TTY for the wizard, declined `--force` confirmation) | `1` |
| Ctrl-C | `130` |

Streams:

- **stdout:** values (listing, single read), the change list and the apply hint.
- **stderr:** errors, warnings and hints, through the client's existing `error` / `warn` /
  `hint` helpers (`kerghan: error: …`, `kerghan: warning: …`, `kerghan: hint: …`), and usage
  errors through `usage_error`. Wizard prompts also go to stderr, like the `reset`
  confirmation, so stdout stays clean.

A refusal writes nothing: every check (all keys, all values, missing files) runs before the
first write.

## Alternatives rejected

- **git-config style** (`kerghan configure port 3002`): rejected in favour of `key=value`, which
  allows several keys in one atomic call.
- **An `--env` flag** to pick the file: unnecessary, the key's case decides it.
- **Commands that also run `up`**: rejected; writing and applying stay separate, and the apply
  hint says which command applies the change.
- **A wizard-only design**: rejected; `configure` is scriptable and shares the writer, so the
  wizard is a thin interactive layer over it.

## Sub-issue map

| Issue | Builds | Reads |
|---|---|---|
| #403 | These specs | — |
| #404 | The shared writer and `kerghan configure` | [files.md](files.md), [configure.md](configure.md), [security.md](security.md) |
| #405 | `kerghan wizard` | [wizard.md](wizard.md), [files.md](files.md), [security.md](security.md) |
| #406 | Fold these specs into the permanent docs (`standalone.md`, `standalone/config.example`, root `README.md`) and delete this folder | all |

## Index

| File | Defines |
|---|---|
| [files.md](files.md) | The two files, key routing, how each is read, write rules, missing files, invalid / duplicate / commented-out lines, unknown keys, value rules, `--unset` restrictions, permissions, atomic writes, symlinks, the apply hint |
| [configure.md](configure.md) | `kerghan configure`: synopsis, listing format, single read, atomic multi-key set, `--unset`, `--show-secrets`, `--force`, `KEY=-`, refused keys, output |
| [wizard.md](wizard.md) | `kerghan wizard`: synopsis, question list and order, bracket defaults, re-asking, `--advanced`, password options, summary and confirmation, abort, no-TTY failure |
| [security.md](security.md) | Masking, inline secrets and the `=-` hint, `--force` on the secrets, cross-key warnings, password change effects, temp-file permissions, Docker footprint |

## Required tests

Exit codes and streams are tested from the "Required tests" section of each command's file
([configure.md](configure.md#required-tests), [wizard.md](wizard.md#required-tests)). Every
other rule is tested from the file that defines it.
