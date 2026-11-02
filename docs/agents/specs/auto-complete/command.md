# `kerghan completion <shell>`

The client command that prints the completion script. Built by #429. Overview:
[README.md](README.md).

## Shape

```
kerghan completion <shell>
```

- **`<shell>` is required.** `bash` is the only supported value. zsh and fish are later Epics;
  keeping the shell as an argument lets each add its value without changing this contract (see
  [contracts.md](contracts.md#kerghan-completion-bash)).
- **No options.** `completion` takes no flags and no other argument.
- **Dispatched like any other command** from `main`'s `case`. `main` has no global startup
  checks today, so nothing runs before it (no config read, no Docker check).
- Loaded with:

  ```bash
  eval "$(kerghan completion bash)"
  ```

  or installed as a file by `install.sh` (see [install.md](install.md)).

## Output and streams

- **Success:** the completion script (see [completion.md](completion.md)) goes to **stdout
  only**, and the exit code is `0`. Nothing else is printed on either stream.
- **Error:** a usage error through the client's `usage_error`: `kerghan: error: <message>`
  followed by the full `usage` text, both on **stderr only**, nothing on stdout, exit `2`.
- **Why stdout stays clean on error** (edge case 19): an rc line
  `eval "$(kerghan completion bash)"` must never evaluate an error message. After a downgrade to
  a client without `completion`, that client prints its own usage error on stderr, so the
  `eval` gets an empty string. Every client that has `completion` keeps the same split for its
  own errors.
- **Consequence after a downgrade:** the older client's usage error (about 45 lines of `usage`)
  then prints on stderr in every new shell. This is accepted; the user docs may show the rc line
  as `eval "$(kerghan completion bash 2>/dev/null)"` to silence it.

## Error cases

Edge case 18. Each is a usage error (`usage_error`: message and usage on stderr, exit `2`):

| Call | Result |
|------|--------|
| `kerghan completion` (no shell) | usage error |
| `kerghan completion zsh`, `fish`, or any other value | usage error naming the shell and the supported ones (e.g. `kerghan: error: unsupported shell 'zsh' (supported: bash)`) |
| `kerghan completion -x` (an option-like first word) | usage error naming the option |
| `kerghan completion bash extra` (extra arguments) | usage error |

These follow the client's existing usage-error convention: `usage_error` prints
`kerghan: error: <message>` and the `usage` text on stderr and exits `2`, like every other
command's usage errors. The exact messages are in
[Messages and exit codes](#messages-and-exit-codes).

### Messages and exit codes

**`usage` line,** in the `Commands:` block between `wizard` and `version`, in the same
two-column style (the description starts at column 35, like the other lines):

```
  completion bash                 print the bash completion script (load it with: eval "$(kerghan completion bash)")
```

There is no "Options for completion" section.

**Error messages,** all through `usage_error`, in the client's quoted style. Each call exits
`2`, prints the line below then the full `usage` text on stderr, and prints nothing on stdout.

| Call | stderr first line |
|------|-------------------|
| `kerghan completion` | `kerghan: error: missing shell (supported: bash)` |
| `kerghan completion zsh` (any unsupported value) | `kerghan: error: unsupported shell 'zsh' (supported: bash)` |
| `kerghan completion -x` (an option-like first word) | `kerghan: error: unknown option '-x'` |
| `kerghan completion bash extra` | `kerghan: error: unexpected argument 'extra'` |

- **Order of checks:** the first argument is checked first (missing, then option-like, then
  unsupported), then extra arguments. So `kerghan completion zsh extra` reports the unsupported
  shell, and `kerghan completion -x extra` the unknown option.
- **Option-like** means a first word starting with `-` (`-x`, `--help`).
- The quoted value is the word as typed, so `kerghan completion Bash` reports
  `unsupported shell 'Bash' (supported: bash)`.

## No side effects

Performance & security item 2. `kerghan completion bash` prints the script and exits. It never:

- reads `~/.kerghan/config` or `kerghan.env`;
- creates `~/.kerghan` or anything under it;
- calls Docker, Vault or the network;
- depends on the current directory or on environment variables for its output (see
  [security.md](security.md#fixed-text)).

This matters because the `eval` route runs it on every new shell.

## `usage`

The `usage` text gains a `completion` line among the commands (backward compatibility item 1).
Bats tests that check the full usage text are updated with it. The exact line is in
[Messages and exit codes](#messages-and-exit-codes).

## Required tests

- `kerghan completion bash` exits `0` and prints the completion script on stdout, with nothing
  on stderr.
- The printed script, when sourced, defines `_kerghan` and registers it for `kerghan`.
- `kerghan completion` exits `2`, and stderr starts with
  `kerghan: error: missing shell (supported: bash)` followed by the usage.
- `kerghan completion zsh` exits `2`, and stderr starts with
  `kerghan: error: unsupported shell 'zsh' (supported: bash)`.
- `kerghan completion -x` exits `2`, and stderr starts with `kerghan: error: unknown option '-x'`.
- `kerghan completion bash extra` exits `2`, and stderr starts with
  `kerghan: error: unexpected argument 'extra'`.
- `kerghan completion zsh extra` reports the unsupported shell, not the extra argument.
- Stdout is empty in every error case.
- `kerghan completion bash` creates nothing under `HOME` and calls no `docker`, `vault` or
  `curl`.
- The `usage` text contains the exact `completion bash` line from
  [Messages and exit codes](#messages-and-exit-codes), between the `wizard` and `version` lines.

> **Open — settled by #428:** the test harness and the full test coverage.
