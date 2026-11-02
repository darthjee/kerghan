# Stable contracts

The interfaces this feature creates that users, rc files, the installer and later Epics rely
on. Overview: [README.md](README.md).

Every contract on this page is **stable**: once a release ships it, it can only grow in
backward-compatible ways. Users put the `eval` line in rc files and aliases in their config, and
`kerghan update` runs installers from other versions, so breaking any of these breaks shells and
updates on released versions.

## `kerghan completion bash`

- **Every later client accepts `kerghan completion bash`** and prints a bash completion script,
  the same rule as `update --finish` (see
  [client-update.md](../../standalone/client-update.md#stable-contracts)). Users put
  `eval "$(kerghan completion bash)"` in rc files.
- **The shell stays an argument.** zsh and fish add their own values (`completion zsh`,
  `completion fish`) without changing `bash`.
- **Streams:** the script on stdout, errors on stderr only (see
  [command.md](command.md#output-and-streams)).
- **The script's content can change freely** from one version to the next.

## `_kerghan`

The completion function name **`_kerghan`** is stable. It is documented for aliases and
symlinks (`complete -o nospace -F _kerghan <name>`, see
[completion.md](completion.md#invocation)), so renaming it would break those users. The
`-o nospace` is part of the line users copy: without it, `KEY=` candidates get a trailing space
(see [completion.md](completion.md#trailing-space)). Helper names (`_kerghan_*`) are not part
of the contract.

## `KERGHAN_COMPLETION`

`KERGHAN_COMPLETION=false` joins the installer interface documented in the `install.sh` header,
next to `KERGHAN_VERSION` and `KERGHAN_INSTALL_DIR`. Every later installer respects it: the
completion step is skipped (see [install.md](install.md#opt-out)).

## Completion file path

```
${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan
```

The path is documented (see [install.md](install.md#target)), so a future uninstaller and the
zsh/fish Epics can rely on it. Later installers keep writing bash completion there.

## Installer `update` contract

The installer's existing contract with `kerghan update` (see the `install.sh` header and
[client-update.md](../../standalone/client-update.md#stable-contracts)) is **kept**. The
completion step adds:

- no prompt;
- no sudo;
- no write outside the install dir and the completion directory, and no write under
  `~/.kerghan`;
- no new failure: the step is never fatal (see [install.md](install.md#never-fatal)). The
  header's "non-zero exit on any failure" is narrowed to the client and `vault` install, which
  is backward compatible (see [install.md](install.md#constraint)).

`update` passes no new variable to the installer.

## Sync rule

Backward compatibility item 9: **any PR that adds or changes a client command, flag, `configure`
key or fixed value updates the completion in the same PR.** #431 folds this rule into the
permanent docs (`docs/agents/standalone.md` and/or `contributing.md`).

**Enforcement:** the sync tests in [completion.md](completion.md#required-tests) enforce the
rule (word-list sources: [completion.md](completion.md#word-lists)):

- the generated lists are compared with the client's constants, after sourcing the client;
- the hand-written lists (commands, per-command flags) are cross-checked against
  `kerghan help`;
- every config key is classified as free-form or fixed-value.

A PR that adds a command, flag, key or value without updating completion fails these tests.

- **The client's constants are not contracts.** The value constants and the
  `FRONTEND_BASE_URL` constant added by #434 are internal to `standalone/bin/kerghan`, and so
  are `CONFIG_KEYS` and `DEFAULT_ENV_KEYS`. Their names may change; the sync tests change with
  them.
- **The `BASH_SOURCE` guard is an internal test contract.** The client can be sourced without
  running `main`, and the sync tests rely on that. #434 documents it in the client header, next
  to the bash 3.2 rule. It is not user-facing.

## Required tests

Each stable contract has at least one test named `@test "contract <name>: …"` (see
[README.md](README.md#testing)), so a failure reads as a user-facing break.

| Label | File | Input or setup | Expected |
|-------|------|----------------|----------|
| `contract completion bash` | `completion_command.bats` | `kerghan completion bash` | exit `0`, a script on stdout, stderr empty (see [command.md](command.md#required-tests)) |
| `contract _kerghan` | `completion_command.bats` | source the script | `complete -p kerghan` prints exactly `complete -o nospace -F _kerghan kerghan` |
| `contract complete -o nospace -F _kerghan kg` | `completion_command.bats` | source the script, run `complete -o nospace -F _kerghan kg`, then complete words `(kg '')`, `(kg up '')` and `(kg configure variant =)` | the same replies as `(kerghan '')`, `(kerghan up '')` and `(kerghan configure variant =)` |
| `contract file path` | `install_completion.bats` | run `install.sh` with neither `BASH_COMPLETION_USER_DIR` nor `XDG_DATA_HOME` set | the file is `$HOME/.local/share/bash-completion/completions/kerghan` (all three resolutions: [install.md](install.md#required-tests)) |
| `contract KERGHAN_COMPLETION=false` | `install_completion.bats` | run `install.sh` with `KERGHAN_COMPLETION=false` | no completion file, no directory created, no completion line on stdout or stderr |
| `contract update` | `install_completion.bats` | run `install.sh` with stdin closed and the target directory unwritable | no prompt, no sudo, nothing under `~/.kerghan`; exit code and final output match a run without the completion step, apart from the `warning:` line |
| sync rule | `completion_sync.bats` | the sync cases | see [completion.md](completion.md#completion_syncbats) |
