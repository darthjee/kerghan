# Auto-complete

Temporary feature specs for **bash tab completion of the `kerghan` client**, delivered by a new
`kerghan completion bash` command and set up by `install.sh`. Product decision: #424.
Lifecycle and conventions: [Feature Specs](../../specs.md).

## Overview

The `kerghan` client (`standalone/bin/kerghan`) has no shell completion today. Users must
remember its commands, their flags, the keys `configure` accepts and the values those keys
take.

This feature adds bash completion through two channels:

1. **`kerghan completion bash`** prints the completion script on stdout, to be loaded with
   `eval "$(kerghan completion bash)"` (see [command.md](command.md)). The script is built into
   the client, so it always matches the installed version, and `kerghan update` keeps it
   current.
2. **`install.sh`** writes that same output into the user-level bash-completion directory,
   where bash-completion v2 lazy-loads it on the first `kerghan <TAB>` (see
   [install.md](install.md)). No rc-file edit and no sudo.

What the script completes, and what it never completes, is defined in
[completion.md](completion.md).

## Scope

In scope:

- **Shell:** bash only, including bash 3.2 (macOS).
- **What is completed:** command names (and `help` / `-h` / `--help` at the top level), each
  command's flags, `configure` keys (the config keys and the static `DEFAULT_ENV_KEYS` names),
  and the values of the keys with a fixed set: `variant`, `runtime`, `auto-login`,
  `restart-on-update` ([completion.md](completion.md)).
- **`kerghan completion <shell>`**: its shape, streams and error cases
  ([command.md](command.md)).
- **The `install.sh` completion step**: target path, content, hint, non-fatal handling, opt-out,
  overwrite and downgrade ([install.md](install.md)).
- **The stable contracts** the feature creates ([contracts.md](contracts.md)) and its
  performance and security rules ([security.md](security.md)).

Out of scope (from #424):

- zsh and fish (see [Follow-up Epics](#follow-up-epics)).
- Completing `update [VERSION]` with release versions, which would need a network call.
- Passing `compose …` / `logs …` arguments through to docker compose's own completion.
- Completion for the `vault` CLI.
- Dynamic lookups (Docker, Vault, GitHub, config or env files) during completion.
- Windows / PowerShell.
- Uninstalling the completion file: there is no uninstaller; its path is documented in
  [install.md](install.md#target).
- The permanent docs (`docs/agents/standalone.md`, `README.md`, the `install.sh` header),
  including lifting "shell completion" from `standalone.md`'s out-of-scope list: folded in by
  #431.

## Follow-up Epics

- **zsh completion** and **fish completion**: separate Epics, created and handled later. The
  shell is a required argument of `kerghan completion <shell>`, so each can add its shell
  without changing the bash contract (see [contracts.md](contracts.md#kerghan-completion-bash)).

## Decisions summary

- **[command.md](command.md):** `kerghan completion <shell>`, `bash` the only supported shell;
  the script goes to stdout with exit `0`, errors to stderr only with a non-zero exit; no side
  effects.
- **[completion.md](completion.md):** one `_kerghan` function registered for `kerghan`;
  commands, flags, `configure` keys and fixed values are completed; free-form values,
  versions, passthrough arguments and hidden steps never are; never a fallback to filenames;
  edge cases 1–17 as behaviour; bash 3.2 compatible.
- **[install.md](install.md):** `install.sh` writes the output of the just-installed client into
  `${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan`
  through a temp file and `mv -f`; prints a `hint:` without `bash-completion`; never fatal;
  opt out with `KERGHAN_COMPLETION=false`; overwrites; a downgrade leaves the file behind.
- **[contracts.md](contracts.md):** `kerghan completion bash`, `_kerghan`,
  `KERGHAN_COMPLETION=false` and the completion file path are stable; the installer's `update`
  contract is unchanged; the sync rule.
- **[security.md](security.md):** TAB is pure bash; the emitted script is fixed text and leaves
  the user's shell untouched; no secrets; safe installer writes; the exact binary.

## Sub-issue map

| Issue | Builds | Reads |
|---|---|---|
| #425 | These specs | — |
| #426 | Specs: single source of truth for the completion word lists | [completion.md](completion.md), [contracts.md](contracts.md) |
| #427 | Specs: exact completion matrix and messages | [completion.md](completion.md), [command.md](command.md), [install.md](install.md) |
| #428 | Specs: testing strategy | every "Required tests" section |
| #429 | Client: `kerghan completion bash` | [command.md](command.md), [completion.md](completion.md), [contracts.md](contracts.md), [security.md](security.md) |
| #430 | Installer: completion setup in `install.sh` | [install.md](install.md), [contracts.md](contracts.md), [security.md](security.md) |
| #431 | Fold these specs into the permanent docs and delete this folder | all |

**Order:** #425 → #426 → #427 → #428 → #429 → #430 → #431. The spec-enhancement sub-issues
edit the same folder, so they go one at a time.

## Open markers

Decisions this folder leaves to later sub-issues. Each is marked in its file as
`> **Open — settled by #NNN:** …`; each sub-issue removes its own markers, and #431 checks that
none remain.

| File | Open decision | Settled by |
|------|---------------|------------|
| [completion.md](completion.md#word-lists) | Source of the word lists (generated from the client's constants vs. hand-written + sync test) | #426 |
| [contracts.md](contracts.md#sync-rule) | How the sync rule is enforced | #426 |
| [completion.md](completion.md#per-position-table) | The exact per-position completion table | #427 |
| [command.md](command.md#messages-and-exit-codes) | The exact `completion` usage line, error messages and exit codes | #427 |
| [install.md](install.md#messages) | The exact `hint:`, `warning:` and success text | #427 |
| Every "Required tests" section | The test harness and full coverage | #428 |

## Index

| File | Defines |
|---|---|
| [command.md](command.md) | `kerghan completion <shell>`: shape, streams, no side effects, error cases, `usage` line |
| [completion.md](completion.md) | Registration, what is completed per command, what is never completed, edge cases 1–17, bash 3.2 |
| [install.md](install.md) | The `install.sh` completion step: target path, content, hint, never fatal, opt-out, overwrite, downgrade, uninstall |
| [contracts.md](contracts.md) | Stable contracts: `completion bash`, `_kerghan`, `KERGHAN_COMPLETION`, the file path, the installer's `update` contract, the sync rule |
| [security.md](security.md) | Performance (pure-bash TAB, no side effects, `eval` cost) and security (fixed text, shell hygiene, no secrets, installer writes, exact binary) |

**Who reads what:** #429 (client) reads `command.md`, `completion.md`, `contracts.md` and
`security.md`; #430 (installer) reads `install.md`, `contracts.md` and `security.md`; #431 reads
all.

## Required tests

Every rule is tested from the "Required tests" section of the file that defines it.
