# Testing bash completion

Part of [Standalone: client completion](../client-completion.md). This page describes how the completion suites are driven, how fresh-shell safety checks work, and where tests live.

## Harness

Tests call `_kerghan` directly with explicit `COMP_WORDS`, rather than simulating readline. This is intentional: word splitting around `=` varies across bash versions, so a helper that reimplemented it would test itself.

`standalone/test/helpers/completion.bash`, loaded after `helpers/setup.bash`, provides:

| Helper | Purpose |
|--------|---------|
| `source_completion` | Writes `$KERGHAN completion bash` to `$BATS_TEST_TMPDIR/completion.bash`, then sources it into the test shell so `COMPREPLY` remains available. |
| `complete_words LINE -- WORD...` | Sets `COMP_LINE`, end-of-line `COMP_POINT`, `COMP_WORDS` and `COMP_CWORD`, then calls `_kerghan`. |
| `complete_line LINE` | Convenience for inputs without `=` or `:`; whitespace-splits and represents a trailing space as an empty last word. Inputs with `=` or `:` must use `complete_words`. |
| `assert_reply WORD...` | Compares exact `COMPREPLY` strings order-insensitively; trailing spaces matter and failures show bracketed words. |
| `assert_no_reply` | Asserts that `COMPREPLY` is empty. |

The cursor is always at the end of the line; mid-line behavior is not tested. Dual `=` cases use both `(… key =)`, `(… key = '')` and partial `(… key = value)` shapes as applicable. Registration is asserted exactly as `complete -o nospace -F _kerghan kerghan`.

## Fresh-shell tests

Hygiene and safety tests run in a fresh `bash --norc --noprofile`, not the Bats shell (which has its own options, functions and variables). The script snapshots `set -o`, `shopt`, `IFS`, `declare -p` names and `declare -F` names; sources completion and runs a representative completion; then compares snapshots. It also checks the same replies with `set -u`, empty PATH and sentinel config/env files.

## Bash 3.2

The complete standalone suite runs under bash 5 and real bash 3.2 (3.2.57, the macOS version), using the pinned Bats 1.11.0 image `dockerfiles/bats_bash32/Dockerfile`. The `standalone_tests_bash32` compose service sets `KERGHAN_TEST_BASH32=1`; CircleCI runs the same suite in its matching job. A guarded test asserts major version 3 so changing the service image cannot silently turn it into bash 5. The same completion cases run in both environments because their `COMP_WORDS` shapes around `=` differ. No static bash-4 syntax lint is used.

## File layout

All completion tests are under `standalone/test/completion*.bats`, with installer behavior in its own file. Every listed test runs in both bash services.

| File | Coverage |
|------|----------|
| `completion.bats` | Candidate matrix, edge cases, registration and dual `=` shapes |
| `completion_command.bats` | Command stdout/stderr/exit codes, usage/errors, generator side effects and command contracts |
| `completion_safety.bats` | Fresh-shell hygiene, no subprocess/file reads, sentinels, deny-list and bash 3.2 guard |
| `completion_sync.bats` | Usage cross-checks, generated lists and free-form/fixed-value classification |
| `install_completion.bats` | Installer path, opt-out, hint, non-fatal errors, overwrite, temp/symlink safety and exact client invocation |

The installer suite uses `helpers/install_setup.bash`; it is separate so `install.bats` does not grow. Existing `install.bats` tests remain unchanged.

## Naming and coverage

Test names follow the documentation labels: `matrix <row label>` for each per-position table row; `edge <n>` for each edge case; and `contract <name>` for every stable interface. Dual `=` shapes share the relevant row label. This keeps coverage easy to inspect with grep; there is no documentation-parsing meta-test or separate coverage table. There are no timing tests; no-subprocess checks provide structural performance evidence.

See [completion behavior tests](behavior.md#required-behavior-tests), [installer tests](installer.md#required-installer-tests), and [security/contract tests](security-contracts.md#required-safety-tests).
