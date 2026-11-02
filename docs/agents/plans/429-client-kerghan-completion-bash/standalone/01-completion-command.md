# `completion` command and `usage` line

Add the command that prints the completion script, as in `docs/agents/specs/auto-complete/command.md`.

- **Dispatch:** add `completion) cmd_completion ${@+"$@"} ;;` to `main`'s `case`, between `wizard` and `version`.
- **`cmd_completion`** checks the arguments in the spec's order, all through `usage_error`:
  1. no argument: `missing shell (supported: bash)`;
  2. a first word starting with `-`: `unknown option '<word>'`;
  3. any value other than `bash`, quoted as typed: `unsupported shell '<word>' (supported: bash)`;
  4. any second argument: `unexpected argument '<word>'`.

  Otherwise it calls the generator, which prints the script on stdout and exits `0`.
- **Generator** (e.g. `completion_bash_script`):
  - Prints the script from step 02. The static parts come from a quoted heredoc, and the generated lists are printed in from the client's constants: `CONFIG_KEYS`, `DEFAULT_ENV_KEYS`, #434's `FRONTEND_BASE_URL` constant and its four value constants.
  - Nothing else goes into the output. No environment variable, `$HOME`, path, config or env-file value, so the output is byte-identical whatever the environment.
  - It reads no file, creates nothing under `~/.kerghan` and calls no `docker`, `vault` or network tool. That means no `load_config`, `ensure_env_file` or `read_settings`.
- **`usage`:** add the spec's exact line (description at column 35) between `wizard` and `version`:

  ```
    completion bash                 print the bash completion script (load it with: eval "$(kerghan completion bash)")
  ```

  Inside the unquoted `USAGE` heredoc, `$(` must be escaped (`\$(`) so the text prints literally.
- **Header comment:** next to the bash 3.2 rule and #434's `BASH_SOURCE` note, say that `completion bash` and `_kerghan` are stable contracts. Also say that the sync rule applies: a new command, flag, `configure` key or fixed value updates the completion in the same PR.

## Files to Change

- `standalone/bin/kerghan`: `main` dispatch, `cmd_completion`, the generator, the `usage` line and the header comment.
