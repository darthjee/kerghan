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
- **Error:** the message goes to **stderr only**, and nothing is printed on stdout. The exit
  code is non-zero.
- **Why stdout stays clean on error** (edge case 19): an rc line
  `eval "$(kerghan completion bash)"` must never evaluate an error message. After a downgrade to
  a client without `completion`, that client prints its own usage error on stderr, so the
  `eval` gets an empty string. Every client that has `completion` keeps the same split for its
  own errors.

## Error cases

Edge case 18. Each is a usage error, with a message on stderr and a non-zero exit:

| Call | Result |
|------|--------|
| `kerghan completion` (no shell) | usage error |
| `kerghan completion zsh`, `fish`, or any other value | usage error naming the shell and the supported ones (e.g. `unsupported shell: zsh (supported: bash)`) |
| `kerghan completion bash extra` (extra arguments) | usage error |

These follow the client's existing usage-error convention (`usage_error`, the same stream and
exit as other commands' usage errors).

### Messages and exit codes

> **Open — settled by #427:** the exact `usage` line for `completion`, the verbatim error
> messages, and the exit code of each error case.

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
Bats tests that check the full usage text are updated with it. The exact line is open (see
[Messages and exit codes](#messages-and-exit-codes)).

## Required tests

- `kerghan completion bash` exits `0` and prints the completion script on stdout, with nothing
  on stderr.
- The printed script, when sourced, defines `_kerghan` and registers it for `kerghan`.
- `kerghan completion` with no shell fails with a non-zero exit, a message on stderr, and
  nothing on stdout.
- `kerghan completion zsh` (an unsupported shell) fails with a non-zero exit, a message on
  stderr naming the shell, and nothing on stdout.
- `kerghan completion bash extra` fails with a non-zero exit and nothing on stdout.
- `kerghan completion bash` creates nothing under `HOME` and calls no `docker`, `vault` or
  `curl`.
- `usage` lists `completion`.

> **Open — settled by #428:** the test harness and the full test coverage.
