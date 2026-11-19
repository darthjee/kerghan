# `kerghan completion <shell>`

Part of [Standalone: client completion](../client-completion.md). This page covers the command that prints the built-in bash completion script, including its scope, streams, usage errors and required tests.

## Overview and scope

The `kerghan` client (`standalone/bin/kerghan`) provides bash completion for its commands, flags, `configure` keys and selected fixed values. The completion script is delivered in two ways:

1. `kerghan completion bash` prints it to stdout, for example `eval "$(kerghan completion bash)"`. Because it is built into the client, it matches that installed version and is refreshed by `kerghan update`.
2. `install.sh` writes the same output into the user-level bash-completion directory for lazy loading. No rc-file edit or sudo is needed.

### Scope

In scope: bash, including bash 3.2 on macOS; command names and accepted flags; `configure` keys and fixed values; command shape, streams and error cases; installer behavior; performance/security rules, stable contracts and tests. The completion data and exact candidate behavior are documented in [What is completed](behavior.md).

Out of scope (from epic #424): zsh and fish (future epics); network-backed `update [VERSION]` completion; docker compose passthrough completion; vault CLI completion; dynamic Docker, Vault, GitHub, config or env-file lookups; Windows/PowerShell; and uninstalling the completion file. The shell remains a required argument so future shells can be added without changing `completion bash`.

## `kerghan completion <shell>`

The command accepts exactly one required shell argument; `bash` is the only supported value. It has no flags or extra arguments and is dispatched as a normal client command. The command performs no global startup checks, reads no config, and does not check Docker before printing the script.

Load interactively with:

```bash
eval "$(kerghan completion bash)"
```

Or source the file installed by `install.sh` (see [Installer setup](installer.md)).

### Output and streams

- On success, the script is written to stdout only and the command exits `0`; neither stream contains other output.
- Errors use `usage_error`: `kerghan: error: <message>` and the full usage text go to stderr only, stdout stays empty, and the exit code is `2`.
- Keeping stdout clean is important for `eval "$(kerghan completion bash)"`: an error must never become shell code. After downgrading to a client without the command, its usage error remains on stderr and `eval` receives an empty string. Users may silence that stderr with `2>/dev/null` in the rc line.

### Error cases and messages

Edge case 18. Check the first argument first (missing, option-like, unsupported), and only then check for extra arguments. An option-like first argument is any word starting with `-`.

| Call | First stderr line |
|------|-------------------|
| `kerghan completion` | `kerghan: error: missing shell (supported: bash)` |
| `kerghan completion zsh` | `kerghan: error: unsupported shell 'zsh' (supported: bash)` |
| `kerghan completion -x` | `kerghan: error: unknown option '-x'` |
| `kerghan completion bash extra` | `kerghan: error: unexpected argument 'extra'` |

Unsupported shell names are quoted as typed (`Bash` stays `Bash`). Thus `completion zsh extra` reports unsupported shell first, and `completion -x extra` reports the unknown option first. All errors above also print the complete usage text on stderr and nothing on stdout.

The `Commands:` section of `kerghan help` includes this line between `wizard` and `version` (description starts at column 35):

```text
  completion bash                 print the bash completion script (load it with: eval "$(kerghan completion bash)")
```

There is no “Options for completion” section.

### No side effects

`kerghan completion bash` only prints the script and exits. It never reads `~/.kerghan/config` or `kerghan.env`, creates anything under `~/.kerghan`, calls Docker, Vault or the network, or varies its output based on the working directory or environment. This matters because the `eval` approach runs the command at every shell start; see [Performance and security](security-contracts.md).

### Required tests

All command tests live in `standalone/test/completion_command.bats`, using the stubs from `helpers/setup.bash`. They cover success and clean streams, function registration, missing/unsupported/quoted shell names, option-like arguments, extra arguments, check ordering, the usage line, and no side effects (including no external calls or changes under `$HOME`). The fixed-output and secret-leak checks are in [Performance and security](security-contracts.md#required-tests).

Existing tests that compare the full usage text must include the new completion line. The alias contract test for `kg` is described in [Stable contracts](security-contracts.md#required-contract-tests).

See also: [completion behavior](behavior.md), [installer setup](installer.md), and [testing](testing.md).
