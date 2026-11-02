# Issue: Client: `kerghan completion bash`

## Description

Implementation sub-issue of the shell autocomplete Epic (#424). It adds the `kerghan completion bash` command and the `_kerghan` completion function to `standalone/bin/kerghan`, with their tests and the bash 3.2 test run. Everything is built against `docs/agents/specs/auto-complete/` (`command.md`, `completion.md`, `contracts.md`, `security.md` and README's `## Testing`). The specs are the source of truth and win over this summary.

**Depends on #434** (word-list constants and the documented `BASH_SOURCE` guard), which must merge first. Order: #425 → #426 → #427 → #428 → #434 → **#429** → #430 → #431.

### Client (`standalone/bin/kerghan`)

- **`kerghan completion bash`**, dispatched from `main`'s `case` ([command.md](../specs/auto-complete/command.md)):
  - prints the completion script on stdout only and exits `0`;
  - errors go through `usage_error` (stderr only, nothing on stdout, exit `2`), checked in this order: missing shell, then option-like word, then unsupported shell, then extra arguments. The exact messages are in the spec.
  - It has no side effects: it reads no config or env, creates nothing under `~/.kerghan` and makes no Docker, Vault or network calls. Its output is byte-identical whatever `HOME`, `PWD`, `XDG_DATA_HOME` and `KERGHAN_*` are.
- **`usage` gains the exact `completion bash` line,** between `wizard` and `version`. Existing bats tests that compare the full usage text are updated in the same PR.
- **The script** ([completion.md](../specs/auto-complete/completion.md)):
  - defines `_kerghan` (helpers prefixed `_kerghan_`) and registers it with exactly `complete -o nospace -F _kerghan kerghan`;
  - appends a trailing space to every candidate except `KEY=` candidates;
  - follows the per-position table and the edge cases exactly.
- **Word lists:**
  - generated from the client's constants: `CONFIG_KEYS`, `DEFAULT_ENV_KEYS`, the `FRONTEND_BASE_URL` constant and the four value constants (#434);
  - hand-written: commands and per-command flags, guarded by the `kerghan help` cross-check.
- **Safety** ([security.md](../specs/auto-complete/security.md)):
  - the script is fixed text, bash 3.2 compatible and needs no bash-completion helpers;
  - TAB runs no subprocess and reads no file;
  - it changes no shell option, `IFS` or global variable, and works under `set -u`;
  - it passes the static deny-list.
- **Stable contracts from this release on:** `completion bash` and `_kerghan` ([contracts.md](../specs/auto-complete/contracts.md)).

### Tests (`standalone/test/`)

The harness is described in README `## Testing`:

- `helpers/completion.bash`: `source_completion`, `complete_words`, `complete_line`, `assert_reply` and `assert_no_reply`;
- `completion.bats`: matrix rows, edge cases, registration and the dual `=` shapes;
- `completion_command.bats`: command output, errors, exit codes, no side effects, fixed text, and the contracts `completion bash`, `_kerghan` and `complete -o nospace -F _kerghan kg`;
- `completion_safety.bats`: fresh-shell hygiene, `set -u`, empty `PATH`, `command_not_found_handle`, sentinel config, generator no-leak, static deny-list and the `BASH_VERSINFO` guard;
- `completion_sync.bats`: the `kerghan help` cross-check, the generated-list checks and the `FREE_FORM_KEYS` classification.

Test names use the spec labels (`matrix <label>:`, `edge <n>:`, `contract <name>:`). Every table row and edge case maps to at least one test, and the reviewer checks this with `grep`.

### bash 3.2 run

- `dockerfiles/bats_bash32/Dockerfile`: `FROM bash:3.2`, with bats-core 1.11.0.
- A `bats_bash32` docker-compose service that runs `standalone/test/completion*.bats` with `KERGHAN_TEST_BASH32=1`.
- A CircleCI job that runs the same glob under that image, alongside the existing `bats standalone/test` job.

### Owners

- **Standalone agent:** the client and the tests.
- **Infra agent:** the Dockerfile, the docker-compose service and the CircleCI job. They stay in this issue, so the 3.2 run lands with the tests it runs.

### Out of scope

- `standalone/install.sh` and `install_completion.bats` (#430).
- The permanent docs (#431).
- The whole suite under bash 3.2 (#433).
- zsh and fish.

## Expected Behavior

- `eval "$(kerghan completion bash)"` in a bash 3.2+ shell gives exactly the completions in `completion.md`.
- Every "Required tests" case cited for #429 exists under its spec label and passes on bash 5 (`bats standalone/test`) and bash 3.2 (the `bats_bash32` service and CircleCI job).
- Apart from the new `usage` line, no existing command changes behaviour.

## Benefits

Users get tab completion with one `eval` line, tested on the bash macOS ships. The installer sub-issue (#430) then has a command to install from.
