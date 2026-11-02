# command.md

Create `docs/agents/specs/auto-complete/command.md` for `kerghan completion <shell>`:

- **Shape:** `kerghan completion <shell>`. `bash` is the only supported shell. The shell is a required argument, so zsh/fish can be added later without changing the contract.
- **Output:** the completion script goes to stdout only, and the exit code is 0. Errors go to stderr only, so `eval "$(kerghan completion bash)"` evaluates an empty string on failure. This includes the downgrade case of a client without `completion` (edge case 19).
- **Error cases:** no shell, an unsupported shell (e.g. `zsh` before its Epic), or extra arguments give a usage error with a non-zero exit (edge case 18).
- **No side effects:** no reads of `~/.kerghan/config` or `kerghan.env`, nothing created under `~/.kerghan`, no Docker, Vault or network calls (Perf 2). It is dispatched like any other command; `main` has no global startup checks today.
- **`usage`** gains a `completion` line.
- **Open marker → #427:** the exact `usage` line, error messages and exit codes.
- **Required tests:** a bullet list of behaviours:
  - `completion bash` exits 0 and prints the script.
  - No shell, or an unsupported shell, fails with a non-zero exit and output on stderr only.
  - Nothing is created under `HOME`; no `docker`/`vault`/`curl` is called.
  - `usage` lists `completion`.
- **Open marker → #428** on the "Required tests" section.

## Files to Change
- `docs/agents/specs/auto-complete/command.md` — new.
