# command.md: usage line and error messages

## `### Messages and exit codes`

Replace the Open marker with:

- **The `usage` line**, placed between `wizard` and `version` in the `Commands:` block, in the two-column style (description starting at column 35, like the other lines):

  ```
    completion bash                 print the bash completion script (load it with: eval "$(kerghan completion bash)")
  ```

  No "Options for completion" section.
- **The error table**: the call, the exact first stderr line, and exit `2`. The full `usage` text follows on stderr, and stdout is empty.

  | Call | stderr first line |
  |------|-------------------|
  | `kerghan completion` | `kerghan: error: missing shell (supported: bash)` |
  | `kerghan completion zsh` (any unsupported value) | `kerghan: error: unsupported shell 'zsh' (supported: bash)` |
  | `kerghan completion -x` (option-like first word) | `kerghan: error: unknown option '-x'` |
  | `kerghan completion bash extra` | `kerghan: error: unexpected argument 'extra'` |

- State the rule behind the table: the first argument is checked first (missing, option-like, unsupported), then extra arguments. So `kerghan completion zsh extra` reports the unsupported shell.

## Other sections

- **`## Error cases`:** replace the colon-form example (`unsupported shell: zsh (supported: bash)`) with the quoted form, and add the option-like row. Link to Messages and exit codes.
- **`## usage`:** drop "The exact line is open" and link to the line above.

## Required tests

Tighten the existing bullets to the exact messages:

- `kerghan completion` exits `2` and stderr starts with `kerghan: error: missing shell (supported: bash)`.
- `kerghan completion zsh` prints `… unsupported shell 'zsh' (supported: bash)`.
- `kerghan completion -x` prints `… unknown option '-x'`.
- `kerghan completion bash extra` prints `… unexpected argument 'extra'`.
- Stdout is empty in every case.
- The `usage` text contains the exact `completion bash` line, between `wizard` and `version`.

## Files to Change
- `docs/agents/specs/auto-complete/command.md` — Messages and exit codes, Error cases, `usage`, Required tests.
