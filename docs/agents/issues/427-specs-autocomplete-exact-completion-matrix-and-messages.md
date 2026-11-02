# Issue: Specs: autocomplete — exact completion matrix and messages

## Description

Spec-enhancement sub-issue of the shell autocomplete Epic (#424). It comes after #425 (feature definition) and #426 (word-list source of truth, merged), and before #428 (testing strategy), which tests against this matrix. #434 (client constants) and #429 (`kerghan completion bash`) build on it.

It writes the exact completion matrix and the exact user-facing text into `docs/agents/specs/auto-complete/`, so #429, #430 and their bats tests have a fixed target. It removes the three `Open — settled by #427` markers (`completion.md` Per-position table, `command.md` Messages and exit codes, `install.md` Messages) and their rows in the README's Open markers table.

This is a docs-only change: no client or installer code.

### Scope

**1. Per-position table (`completion.md`)**

For every command (`up`, `down`, `logs`, `status`, `compose`, `reset`, `update`, `update-env`, `configure`, `wizard`, `version`, `help`, `completion`) and every cursor position, the exact candidates: flags, `configure` keys (`KEY=` or bare after `--unset`), fixed values, or nothing. Rows are keyed by the command and by the context of the word being completed (the previous word, a `KEY=` prefix, or the words already on the line).

The table applies the edge cases from #424 and the rules already in `completion.md`:

- **Flags already on the line** are not offered again, except `configure --unset`. Aliases count as one (`-p` / `--port`).
- **Mutually exclusive pairs** (`--restart` / `--no-restart`, `--auto-login` / `--no-auto-login`): once either is on the line, neither is offered.
- **Free-form flag arguments** (`--bind`, `-p`, `--port`): nothing is offered, and the next word is never taken as a command, flag or key.
- **`KEY=` value completion** across the `=` word break: the current word may be `=` or an empty word after `=`.
- **Keys already on the line** (as `KEY=…` or after `--unset`) are not offered again.
- **`-h` / `--help` / `help`:** top level only.
- **Hidden steps** (`update --finish`): never.
- **Unknown commands:** nothing, and no filename fallback.
- **`completion`:** `bash` at the first position, nothing after it.

**Trailing space on bash 3.2:** bash 3.2 has no `compopt`, so the table fixes the strategy. `_kerghan` is registered with `complete -o nospace -F _kerghan kerghan`. Every candidate gets a trailing space added by the function, except `KEY=` candidates, which stay without one so the value can follow at once. `completion.md`'s Registration section is updated to match: `-o nospace` is the one allowed option, and `-o default`, `-o bashdefault` and `-o filenames` stay forbidden.

**`configure` combinations:** the table mirrors `configure`'s own usage errors, the same reasoning as edge case 10 (never offer a word that turns the line into a usage error):

- once a write (`KEY=…`, `KEY=-` or `--unset`) or `--force` is on the line, `--show-secrets` is not offered;
- once `--show-secrets` is on the line, `--force`, `--unset` and `KEY=` candidates are not offered;
- once a `KEY=-` is on the line, no other `KEY=-` is possible, but `KEY=` candidates are still offered (the value is typed, not `-`).

A bare `KEY` (print one setting) is never offered. Keys complete only as `KEY=`, so reading one key is typed by hand.

**2. `completion` usage line and messages (`command.md`)**

- **`usage` line,** between `wizard` and `version`, in the existing two-column style:

  ```
    completion bash                 print the bash completion script (load it with: eval "$(kerghan completion bash)")
  ```

- **Error messages,** all through `usage_error` (message and full usage on stderr, nothing on stdout, exit `2`), in the client's existing quoted style:

  | Call | stderr first line |
  |------|-------------------|
  | `kerghan completion` | `kerghan: error: missing shell (supported: bash)` |
  | `kerghan completion zsh` (any unsupported value) | `kerghan: error: unsupported shell 'zsh' (supported: bash)` |
  | `kerghan completion -x` (an option-like first word) | `kerghan: error: unknown option '-x'` |
  | `kerghan completion bash extra` | `kerghan: error: unexpected argument 'extra'` |

  This replaces the colon form `unsupported shell: zsh (supported: bash)` used as an example in #424 and `command.md`.

**3. Installer messages (`install.md`)**

Through the installer's existing helpers (`info` on stdout, `warn` and `hint` on stderr, all prefixed `kerghan-install:`). `<file>` is the resolved target path and `<install dir>` the absolute install directory.

- **Success:** one `info` line, `kerghan-install: bash completion installed to <file>`, printed after the existing `kerghan <version> installed to …` line.
- **bash-completion not detected:** after the success line,

  ```
  kerghan-install: hint: bash-completion was not found; to enable completion, add this to ~/.bashrc:
    source "<file>"
  ```

  The second line is printed with `echo … >&2`, the same way `check_path` prints its `export PATH` line.
- **Failure:** one `warn` line naming what failed, and no success line:
  - `kerghan-install: warning: could not create <dir>; skipping bash completion`
  - `kerghan-install: warning: <install dir>/kerghan completion bash failed; skipping bash completion`
  - `kerghan-install: warning: could not write <file>; skipping bash completion`
- **`KERGHAN_COMPLETION=false`:** nothing is printed.
- The exit code is never changed by this step (already fixed in `install.md`'s Never fatal).

**Detecting bash-completion** (which decides when the hint prints): the step looks for a fixed list of known `bash_completion` script paths (the Linux distro path, Homebrew on Apple silicon and on Intel, and MacPorts) and treats any existing one as installed. It never runs bash-completion or reads the user's rc files. The exact list is written in `install.md`.

### Out of scope

- The source of the word lists (settled by #426).
- The test harness and the full coverage (#428).
- Client and installer code (#434, #429, #430).

## Expected Behavior

- `completion.md` holds the full per-position table. Every edge case from #424 and every rule in `completion.md` maps to a row or a rule.
- `completion.md`'s Registration allows `-o nospace` and states the trailing-space rule.
- `command.md` holds the exact `usage` line and every error message verbatim, with exit `2`.
- `install.md` holds the success, `hint:` and `warning:` text verbatim, and the bash-completion detection paths.
- The three #427 Open markers and their README rows are gone; the #428 markers stay.

## Benefits

#429, #430 and #428's tests share one exact target, the same way the `configure` and `wizard` outputs were fixed in #403.
