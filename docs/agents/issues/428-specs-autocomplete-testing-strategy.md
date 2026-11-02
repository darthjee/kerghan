# Issue: Specs: autocomplete — testing strategy

## Description

Spec-enhancement sub-issue of the shell autocomplete Epic (#424). It follows the specs, single-source-of-truth and completion-matrix sub-issues, and is the last spec change before implementation.

Define how bash completion is tested, and write it into the "Required tests" sections of `docs/agents/specs/auto-complete/` (plus a short testing section in `README.md`).

### Scope

In scope:

- **Harness:** how a bats test drives `_kerghan` (source the output of `kerghan completion bash`, set `COMP_WORDS`/`COMP_CWORD`/`COMP_LINE`/`COMP_POINT`, call the function, assert `COMPREPLY`), following the conventions of `standalone/test/`.
- **Matrix coverage:** every row of the completion matrix, and every edge case from #424, maps to at least one test.
- **Shell hygiene tests:** sourcing the script changes no shell options (`set -e`/`-u`/`pipefail`, `shopt`), leaves no global variables except `_kerghan*`, and leaves `IFS` unchanged.
- **Safety tests:** TAB starts no subprocess and reads no file (e.g. stub `docker`, `vault`, `curl` and `kerghan` on PATH to fail, and point `HOME` at an empty temp dir); `kerghan completion bash` makes no Docker, Vault or network call and creates nothing under `~/.kerghan`.
- **bash 3.2:** how bash 3.2 compatibility is checked (e.g. a CI job or container running bash 3.2, or a lint rule), consistent with what the client already does.
- **Sync check:** the test enforcing the sync rule, per the single-source-of-truth decision.
- **Installer tests:** the target path (`BASH_COMPLETION_USER_DIR`, `XDG_DATA_HOME`, the default), `KERGHAN_COMPLETION=false`, the hint without `bash-completion`, the non-fatal write failure, overwriting an existing file, and running the just-installed client rather than `kerghan` from PATH.

This issue turns decisions that already exist into concrete tests; it makes no new behaviour decisions. Concretely:

- Each "Required tests" list becomes concrete test cases: the input line or setup, the exact expected `COMPREPLY` or output, and the target bats file.
- Matrix rows and edge cases are referenced by the labels the completion-matrix sub-issue gives them, not copied; `README.md` states the coverage rule (every row and every edge case maps to at least one named test).
- The sync rule from the single-source-of-truth sub-issue becomes a concrete test.
- How bash 3.2 is checked, including any new docker-compose/CI service, is defined here **as a spec**.
- The harness is described once in `README.md`, and every `> **Open — settled by #428:**` marker is removed.

Out of scope:

- Writing the bats files and helpers: the client sub-issue writes the client tests, the installer sub-issue the installer tests.
- Building the bash 3.2 docker-compose/CI service: the client sub-issue builds what this issue specifies (infra review as needed); no separate infra sub-issue.
- Moving test documentation into `docs/agents/standalone.md`: the fold-into-permanent-docs sub-issue does that.
- Re-deciding behaviour: if writing a test exposes a gap in the matrix or strings, it is fixed in the spec file that owns it, within this issue, not spun off.

### Ordering

This issue depends on the single-source-of-truth (#426) and completion-matrix (#427) sub-issues, and both are now merged. The test cases are written against their merged rules: the `-o nospace` registration and trailing-space rule, the per-position table, the exact messages, and the generated/hand-written word-list split.

## bash 3.2 verification

Decision: run the completion tests under a real bash 3.2, in addition to the existing bash 5 run. No static lint.

- **Image:** `dockerfiles/bats_bash32/Dockerfile`, `FROM bash:3.2` (official image, bash 3.2.57 — the version macOS ships), with bats-core installed at the same pinned version as the existing suite (1.11.0).
- **docker-compose:** a new service next to the existing bats one (e.g. `bats_bash32`) that runs only the completion test files (the completion behaviour tests, plus the `completion bash` command tests if they live in their own file).
- **CircleCI:** a job running the same files under that image, alongside the existing `bats standalone/test` job. The full suite keeps running on bash 5, so completion is tested under both.
- **Guard:** a test asserting `BASH_VERSINFO[0] -eq 3` when run in that service, so a base-image change cannot silently turn it into a bash 5 run.
- **Same tests on both versions:** bash 3.2 and 4+ split `COMP_WORDS` differently around `=` (`COMP_WORDBREAKS`), so the `=` cases (`variant=`, `--port=`, …) run in both services from the same file; there are no 3.2-only tests.
- The client sub-issue builds the image, service and job as specified here.

Rejected: running the whole suite under 3.2 (the right long-term goal, but outside this Epic — spun off as a separate issue); a static lint for bash-4-only syntax (redundant once every matrix row runs under 3.2, brittle, and prone to false positives).

## Harness

Tests drive `_kerghan` directly in the test shell with explicit `COMP_WORDS`; they do not simulate readline (word splitting depends on the bash version, so a helper re-implementing it would test itself).

`standalone/test/helpers/completion.bash`, loaded after `helpers/setup.bash` (reusing its temp `HOME` and failing stubs), provides:

- **`source_completion`:** writes `"$KERGHAN" completion bash` to `$BATS_TEST_TMPDIR/completion.bash` and sources it into the test shell itself (not through `run`, since `COMPREPLY` is read afterwards).
- **`complete_words LINE -- WORD...`:** the core call. Sets `COMP_LINE=LINE`, `COMP_POINT=${#LINE}`, `COMP_WORDS=(WORD...)`, `COMP_CWORD` to the last index, and calls `_kerghan kerghan "$cur" "$prev"` (the three arguments bash passes). The cursor is always at the end of the line; mid-line completion is not tested.
- **`complete_line LINE`:** convenience for lines without `=` or `:`: splits on whitespace only (a trailing space becomes an empty last word). It fails the test if `LINE` contains `=` or `:`, forcing those cases through `complete_words`.
- **Dual `=` shapes:** every `=` case runs with each shape the spec names: `kerghan configure variant=` as `(… variant =)` and `(… variant = '')`; `variant=on` as `(… variant = on)`. Together with the bash 3.2 service this covers both versions without guessing which split each produces.
- **`assert_reply WORD...`:** `COMPREPLY` equals the expected words exactly, order-insensitive. Trailing spaces are significant, so "no trailing space after `variant=`" is an exact-string assertion whatever mechanism the completion matrix picks. On failure it prints expected vs actual with each word bracketed (`[up ]`).
- **`assert_no_reply`:** `COMPREPLY` is empty.
- **Registration:** `complete -p kerghan` prints exactly `complete -o nospace -F _kerghan kerghan`.

Hygiene and safety tests do not run in the bats shell (bats enables `errexit`/`errtrace` and defines its own functions and variables). They run a fresh `bash --norc --noprofile` with a small script that snapshots `set -o`, `shopt`, `IFS`, `declare -p` names and `declare -F` names, sources the script, runs a completion, snapshots again, and diffs. The same fresh shell also runs the representative completions with `set -u` on and expects the same replies and empty stderr.

## Proving no subprocess and no file read

Three complementary checks on the generated script (no single one is sufficient, especially on bash 3.2):

1. **Empty-`PATH` runtime check (both bash versions):** in the fresh `bash --norc --noprofile` shell, with `PATH` set to an empty directory and `HOME` to an empty temp dir, a set of representative completions (top level, a flag, a `configure` key, a fixed value) each returns the expected reply, with empty stderr and exit `0`. On bash 5 only, a `command_not_found_handle` logging to a file is also defined and the log must be empty (bash 3.2 has no such hook; the stderr check covers it there).
2. **Sentinel config check:** the same completions with `HOME` containing `~/.kerghan/config` and `~/.kerghan/kerghan.env` holding sentinel keys (e.g. `SENTINEL_KEY=x`): replies are identical to the empty-`HOME` run and no sentinel appears. This catches reads through builtins (`read`, `<`, `source`) that a `PATH` check cannot.
3. **Static deny-list on the printed script:** after stripping comment lines, the script contains no `$(`, backtick, or `|` (these fork — `$(…)` even of builtins only, which no runtime check sees on bash 3.2); no `<`, `<(`, or `>` redirection; no `source`, `.` as a command, `eval`, `read`, or `exec`; and no `$HOME`, `~`, or `.kerghan`. The script is fixed text, so the grep is reliable; a false positive just pushes the code to a simpler form. If the implementation ever genuinely needs one of these, the exception is added to the spec explicitly.

For the generator, `kerghan completion bash`: run with the existing stubs and `STUB_LOG`, the log stays empty; `find "$HOME"` is identical before and after; `~/.kerghan` does not exist afterwards.

## Sync check

The three sync checks from `completion.md`'s Required tests (word-list sources per #426), all in `completion_sync.bats`:

1. **Usage cross-check (hand-written lists):** `kerghan help` is a hand-written heredoc, and commands and flags are hand-written in `_kerghan`. The test parses `kerghan help` and compares it with what completion offers:
   - **Commands** under `Commands:` equal the top-level completion commands (`help`/`-h`/`--help` checked separately).
   - **Flags per command** from each synopsis line (`up [--offline] [-p PORT] …`, `configure [--force] [--unset KEY]…`, `wizard [--advanced]`, …), with `--[no-]x` expanded to `--x` and `--no-x` and `-p, --port` counting as both, equal that command's completion flags.
   - **Config keys** under `Settings are read from …` equal the `configure` keys completion offers; env key names are compared against `DEFAULT_ENV_KEYS` plus `FRONTEND_BASE_URL` read from the client.
   - **Exclusions** (only the hidden `--finish` today) are the explicit, commented exclusion list `completion.md` defines, so adding one is a visible diff.
2. **Generated lists:** the test sources the client (relying on its `BASH_SOURCE` guard, so `main` doesn't run) to read `CONFIG_KEYS`, `DEFAULT_ENV_KEYS`, the `FRONTEND_BASE_URL` constant and the four value constants (#434), then checks that completion offers exactly those: `configure <TAB>` keys, `--unset <TAB>` keys (config keys plus `FRONTEND_BASE_URL`, no `DEFAULT_ENV_KEYS`) and each `KEY=<TAB>` value list. Constant names are internal; the test changes with them.
3. **Classification:** the test holds the commented `FREE_FORM_KEYS` list (`port`, `bind`, `image-tag`, `stop-timeout`); every `CONFIG_KEYS` entry is in it or has a value constant, never both and never neither.

Lists are compared as sets. Failures name the word and the side it is missing from (e.g. `--bind: in usage, not in completion`).

## Coverage

- **Row labels:** this issue adds a `Label` column to every per-position table in `completion.md` (short kebab-case labels such as `top-first`, `top-later`, `up-flag-arg`, `up-flags`, `cfg-unset`, `cfg-value`, `cfg-free`, `cfg-show-secrets`, `cfg-other`). Labels are unique across the tables and stable once tests cite them.
- Test names start with the spec label: `@test "matrix <row label>: …"` for each per-position table row and `@test "edge <n>: …"` for each edge case. Every row and every edge case has at least one test (the dual `=` shapes count under one label), so coverage is checkable with `grep`.
- Each "Required tests" list cites the same labels; the reviewer of the client and installer sub-issues checks them against the test names.
- No coverage table and no meta-test parsing the spec files: both would break or decay when the spec folder is deleted by the fold-into-permanent-docs sub-issue.

## Test file layout

All client completion tests live in `standalone/test/completion*.bats`; the bash 3.2 service runs exactly that glob.

| File | Holds | bash 5 | bash 3.2 |
|---|---|---|---|
| `completion.bats` | matrix rows, edge cases, registration, dual `=` shapes | ✓ | ✓ |
| `completion_command.bats` | `kerghan completion …` output, errors, exit codes, generator side effects, contracts (`_kerghan`, `complete -o nospace -F _kerghan kg`) | ✓ | ✓ |
| `completion_safety.bats` | hygiene snapshot, empty-`PATH`, sentinel config, static deny-list, `BASH_VERSINFO` guard | ✓ | ✓ |
| `completion_sync.bats` | usage cross-check and the single-source-of-truth test | ✓ | ✓ |
| `install_completion.bats` | installer step: path resolution, opt-out, hint, non-fatal, overwrite, temp file and symlink, not executable, runs the just-installed client; uses `helpers/install_setup.bash` | ✓ | — |

- `install_completion.bats` is kept out of the 3.2 glob (running `install.sh` under 3.2 is #433's scope) and keeps `install.bats` from growing.
- The `BASH_VERSINFO` guard is skipped unless `KERGHAN_TEST_BASH32=1`, which the bash 3.2 service sets.

## Backward compatibility

- Tests guarding a stable contract from `contracts.md` are named `@test "contract <name>: …"` (`completion bash`, `_kerghan`, `complete -o nospace -F _kerghan kg`, the file path, `KERGHAN_COMPLETION=false`), so a failure reads as a user-facing break.

## Installer: bash-completion detection in tests

`install.md` leaves it to this issue how tests control the four fixed detection paths. Decision: **an overridable path list.**

- `install.sh` keeps the four paths as its default detection list. An internal, test-only variable (e.g. `KERGHAN_BASH_COMPLETION_PATHS`, space-separated) replaces the list when set.
- It only decides whether the hint is printed: it never changes the target path or what is written.
- It is not a stable contract and is not documented in the `install.sh` header next to `KERGHAN_VERSION`, `KERGHAN_INSTALL_DIR` and `KERGHAN_COMPLETION`.
- `install_completion.bats` points it at files under the test root: one case with no listed file existing (hint printed), one with a listed file existing (no hint).
- This issue writes the variable into `install.md`, and #430 builds it.

Rejected: a test-root prefix on every path (could be mistaken for a general install root); the real paths with no override (the result depends on the host or CI image).
- Existing installer tests stay untouched (same prompts, exit codes, no sudo). `install_completion.bats` adds a failing-completion-step case (unwritable target dir) asserting the installer's exit code and final output are unchanged.

## Performance & security

- No timing tests: speed is guaranteed structurally by the no-subprocess checks; wall-clock assertions would be flaky in CI.
- Security tests are mapped to files: hygiene, no file read and no environment-derived text in `completion_safety.bats`; generator output identical across `HOME`/`PWD`/`XDG_DATA_HOME`/`KERGHAN_*` values in `completion_command.bats`; temp file, symlink replacement and non-executable file in `install_completion.bats`.
- **No secret leak:** with `kerghan.env` holding a sentinel secret value, neither the generator output nor any completion reply contains it.

## Expected Behavior

Each spec file's "Required tests" section in `docs/agents/specs/auto-complete/` lists concrete test cases — input or setup, exact expected `COMPREPLY` or output, target bats file, and the matrix/edge/contract label — that the client and installer sub-issues implement. `README.md` describes the harness, the bash 3.2 service, the file layout and the naming convention once. No `> **Open — settled by #428:**` marker remains.

## Benefits

The implementation sub-issues have a complete, agreed test list, and completion can't regress or drift unnoticed.
