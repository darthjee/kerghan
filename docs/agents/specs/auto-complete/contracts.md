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
symlinks (`complete -F _kerghan <name>`, see [completion.md](completion.md#invocation)), so
renaming it would break those users. Helper names (`_kerghan_*`) are not part of the contract.

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
[client-update.md](../../standalone/client-update.md#stable-contracts)) is **unchanged**. The
completion step adds:

- no prompt;
- no sudo;
- no write outside the install dir and the completion directory, and no write under
  `~/.kerghan`;
- no new failure: the step is never fatal (see [install.md](install.md#never-fatal)).

`update` passes no new variable to the installer.

## Sync rule

Backward compatibility item 9: **any PR that adds or changes a client command, flag, `configure`
key or fixed value updates the completion in the same PR.** #431 folds this rule into the
permanent docs (`docs/agents/standalone.md` and/or `contributing.md`).

> **Open — settled by #426:** how the rule is enforced (word lists generated from the client's
> constants, or a sync test between `usage` / the constants and the completion).

## Required tests

- `kerghan completion bash` is accepted and prints a script on stdout.
- The script defines `_kerghan` and registers it for `kerghan`; `complete -F _kerghan kg` then
  completes `kg` the same way.
- `install.sh` with `KERGHAN_COMPLETION=false` skips the completion step.
- `install.sh` writes the completion file at the documented path.
- The completion step adds no prompt and no sudo, and a completion failure does not change the
  installer's exit code.

> **Open — settled by #428:** the test harness and the full test coverage.
