# install.md

Create `docs/agents/specs/auto-complete/install.md`: the `install.sh` completion setup.

- **Constraint:** keep the installer's `update` contract from its header: no prompts, no sudo, `mv -f` as the only write, never touch `~/.kerghan`.
- **Target:** `${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan`, lazy-loaded by bash-completion v2.
  - Rejected: system directories (need sudo) and editing `~/.bashrc` (intrusive, not idempotent).
- **Content:** the static output of `<install dir>/kerghan completion bash`, the client just installed and never `kerghan` from PATH.
  - Written to a temp file in the target directory, then `mv -f`'d into place.
  - The directory is created with `mkdir -p`.
  - Refreshed on every install and every `kerghan update`, since `update` reruns `install.sh`.
  - Rejected: a loader line (`eval "$(kerghan completion bash)"`), because it may run a different `kerghan`.
- **Without the `bash-completion` package:** still install the file, and print a `hint:` with the manual line (`eval "$(kerghan completion bash)"` or `source <file>`).
- **Never fatal:** any failure prints a `warning:`, and the install or update still succeeds.
- **Opt-out:** `KERGHAN_COMPLETION=false` skips the step. `update` does not pass it, so the step is on by default.
- **Overwrite:** an existing file, including a hand-written one, is replaced. This is documented.
- **Downgrade:** an older `install.sh` leaves the newer file behind. Accepted and documented.
- **Uninstall:** out of scope; the file's path is documented.
- **Open marker → #427:** the exact `hint:`, `warning:` and success text.
- **Required tests:** a behaviour list:
  - Path resolution with each variable, and the default.
  - Opt-out.
  - Hint without bash-completion.
  - Write failure only warns.
  - Overwrite.
  - Runs the just-installed client.
  - Nothing under `~/.kerghan`.
  - No sudo or prompts.
- **Open marker → #428** on the "Required tests" section.

## Files to Change
- `docs/agents/specs/auto-complete/install.md` — new.
