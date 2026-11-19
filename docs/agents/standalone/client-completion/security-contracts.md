# Performance, security and stable contracts

Part of [Standalone: client completion](../client-completion.md). This page records the performance and security requirements, the interfaces that must remain compatible, the synchronization rule and their required tests.

## Performance and security

Performance and security items 1–9 are from epic #424.

### Performance

1. Pressing TAB is pure bash: no subprocess (including `kerghan`, Docker, Vault, curl, grep or sed) and no file reads. Word lists are built into the script.
2. `kerghan completion bash` only prints the script and exits; it has no side effects.
3. `eval "$(kerghan completion bash)"` costs one client process per shell start. Prefer the lazy-loaded file installed by `install.sh`; use `eval` when bash-completion is missing.

### Security

4. The trust boundary does not change: evaluating the client's output trusts no more than running the client itself.
5. Output is fixed text for a given client version. It is built only from client constants, never interpolating environment/config values, `$HOME`, the working directory or paths. Runs under different environments print identical bytes.
6. Sourcing the script defines only `_kerghan` and optional `_kerghan_*` helpers plus the completion registration; all function variables are local. It changes no shell options, `shopt`, or lasting `IFS`, and works with `set -u` enabled. Bash 3.2 constraints are in [completion behavior](behavior.md#edge-cases).
7. Completion never reads `kerghan.env` or `~/.kerghan/config`, and never completes secret/env values. The offered env key names are static public names.
8. Installer writes use a target-directory temp file and `mv -f` (atomic replacement, including replacing a symlink rather than following it), create directories under the user's umask, produce a non-executable file, use no sudo and stay under the user completion directory. Failure removes the temp file.
9. The installer invokes `<install dir>/kerghan completion bash`, not a PATH-selected client; this matches the exact-binary rule in [client-update](../client-update.md#stable-contracts).

### Required safety tests

`completion_safety.bats` runs fresh shells under both bash services and covers shell-option/IFS/name hygiene, `set -u`, representative completions with an empty PATH, a bash 5 `command_not_found_handle` check, sentinel config/env files, generator secret leakage, a static deny-list and the bash 3.2 service guard. If a denied token is genuinely needed, the test must explicitly allow the exact occurrence with a reason.

The fixed-output test in `completion_command.bats` runs the generator with different HOME/PWD/XDG/KERGHAN values and compares bytes. `install_completion.bats` covers target-directory temp files, symlink replacement, file mode and exact-binary invocation. There are no timing assertions: no-subprocess checks enforce performance structurally.

## Stable contracts

Once shipped, these interfaces can only grow compatibly: users add eval lines to rc files, aliases refer to the completion function and `kerghan update` runs installers from different versions.

### `kerghan completion bash`

Every later client accepts this exact command and prints a bash completion script. The shell stays an argument so zsh/fish can be added without changing bash. Success output stays on stdout; errors stay stderr-only. Script contents may change between releases.

### `_kerghan`

`_kerghan` is stable because aliases and symlinks may register it manually. The supported registration is `complete -o nospace -F _kerghan <name>`; `-o nospace` is required to preserve `KEY=` spacing. `_kerghan_*` helper names are not stable.

### `KERGHAN_COMPLETION`

Every later installer respects `KERGHAN_COMPLETION=false` and skips the completion step.

### Completion file path

Later installers continue to write to:

```text
${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan
```

This path is documented for users and future uninstallers/shell support.

### Installer `update` contract

The existing contract is retained: no prompt, no sudo, no writes beyond the install and completion directories, no writes under `~/.kerghan`, and no new installer failure because completion errors only warn. `update` passes no new variable to the installer. See [installer setup](installer.md#constraint).

### Sync rule

Any PR adding or changing a client command, flag, `configure` key or fixed value updates completion in the same PR. This Definition of Done is in [Contributing](../../contributing.md#definition-of-done-for-prs) and is linked from [Standalone Distribution](../standalone.md). `completion_sync.bats` enforces it:

- Generated lists are compared with client constants after sourcing the client.
- Hand-written commands/flags are cross-checked against `kerghan help`.
- Every config key is classified as free-form or fixed-value.

A change to the client's constants without updating completion fails tests. The constants themselves (`CONFIG_KEYS`, `DEFAULT_ENV_KEYS`, value constants, and `FRONTEND_BASE_URL`) are internal, not stable user contracts. The `BASH_SOURCE` guard used to source the client without running `main` is an internal test contract.

### Required contract tests

Tests use `@test "contract <name>: …"` labels. They cover command/output, `_kerghan` registration, manual `kg` registration with `-o nospace`, default completion file path, opt-out, update non-interactivity/no-sudo/no-write behavior and unchanged exit behavior, plus the sync test suite. Installer details are in [installer tests](installer.md#required-installer-tests); command behavior is in [command tests](command.md#required-tests).
