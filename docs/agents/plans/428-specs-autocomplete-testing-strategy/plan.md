# Plan: Specs: autocomplete — testing strategy

Issue: [428-specs-autocomplete-testing-strategy.md](../../issues/428-specs-autocomplete-testing-strategy.md)

## Overview

A spec-only change to `docs/agents/specs/auto-complete/`. It writes the testing strategy once in `README.md` (harness, bash 3.2 service, file layout, naming and coverage rule), adds row labels to `completion.md`'s per-position tables, and turns every "Required tests" section into concrete test cases. Each case gives the input or setup, the exact expected `COMPREPLY` or output, the target bats file and its label. It then removes every `Open — settled by #428` marker. No code or test files are written here: #429 writes the client tests and builds the bash 3.2 service, and #430 writes the installer tests and builds the detection override.

## Context

Epic #424. #426 (word-list sources) and #427 (per-position table, messages) are merged; the cases are written against their text.

Decisions made in the issue (copy them as written, do not re-decide):

- **Harness:** `standalone/test/helpers/completion.bash`, loaded after `helpers/setup.bash`, with:
  - `source_completion`;
  - `complete_words LINE -- WORD...` (the core call);
  - `complete_line LINE`, which refuses `=` and `:`;
  - `assert_reply WORD...` (exact strings, order-insensitive, bracketed diff);
  - `assert_no_reply`.

  The cursor is always at the end of the line. `=` cases run in every split shape the spec names.
- **Fresh-shell tests:** hygiene and safety tests run in a fresh `bash --norc --noprofile`. They snapshot `set -o`, `shopt`, `IFS` and the variable and function names before and after, and run completions with `set -u`.
- **No subprocess and no file read**, shown three ways:
  - completions run with an empty `PATH`, plus a `command_not_found_handle` log on bash 5;
  - a sentinel `~/.kerghan` that no reply may expose;
  - a static deny-list over the printed script.

  The generator itself is checked with `STUB_LOG` and a `find "$HOME"` diff.
- **bash 3.2:**
  - The image is `dockerfiles/bats_bash32/Dockerfile`, `FROM bash:3.2`, with bats-core 1.11.0.
  - A docker-compose service (`bats_bash32`) and a CircleCI job run `standalone/test/completion*.bats`. The service sets `KERGHAN_TEST_BASH32=1`, and a guard test then asserts `BASH_VERSINFO[0] -eq 3`.
  - The tests are the same on both versions. Running the whole suite under 3.2 is #433.
- **File layout:**
  - `completion.bats`, `completion_command.bats`, `completion_safety.bats` and `completion_sync.bats` run on both bash versions.
  - `install_completion.bats` runs on bash 5 only and uses `helpers/install_setup.bash`.
- **Naming:**
  - `@test "matrix <label>: …"`, `@test "edge <n>: …"` and `@test "contract <name>: …"`.
  - Every row and every edge case has at least one test, checked with `grep`.
  - No coverage table and no meta-test.
- **Sync:**
  - the `kerghan help` cross-check (commands and synopsis flags; `--[no-]x` expanded; aliases; the `--finish` exclusion list);
  - the generated lists compared with the client's constants, after sourcing the client through its `BASH_SOURCE` guard;
  - the `FREE_FORM_KEYS` classification.

  All three compare sets and name the missing side.
- **Installer detection:** an internal, test-only `KERGHAN_BASH_COMPLETION_PATHS` (space-separated) replaces the four default detection paths.
  - It only decides whether the hint prints.
  - It is not a contract and stays out of the `install.sh` header.
- **Labels:** a `Label` column is added to the per-position tables (see step 01).

## Steps

- [01 — README testing strategy and row labels](plan/01-readme-and-labels.md)
- [02 — completion.md Required tests](plan/02-completion-tests.md)
- [03 — command, contracts and security Required tests](plan/03-command-contracts-security-tests.md)
- [04 — install.md detection override and Required tests](plan/04-install-tests.md)

## Notes

- Verify by reading: `grep -rn 'settled by #428' docs/agents/specs/auto-complete/` must print nothing, and `grep -rn 'settled by #4' docs/agents/specs/auto-complete/` must print nothing either (no open marker remains for #431 to find).
- Edit only `docs/agents/specs/auto-complete/`. Do not create bats files, helpers, Dockerfiles, compose services or CI jobs.
- Copy messages, registration lines and lists verbatim from the merged spec text; never paraphrase an expected string.
- If writing a case exposes a gap in the table or the messages, fix it in the file that owns it, in this change, and say so in the PR body.
- Keep the existing prose style: short sentences, bullet lists, tables, no line over ~100 characters.
