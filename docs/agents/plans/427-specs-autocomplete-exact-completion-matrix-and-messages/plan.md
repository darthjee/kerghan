# Plan: Specs: autocomplete — exact completion matrix and messages

Issue: [427-specs-autocomplete-exact-completion-matrix-and-messages.md](../../issues/427-specs-autocomplete-exact-completion-matrix-and-messages.md)

## Overview

A spec-only change to `docs/agents/specs/auto-complete/`. It writes the exact per-position completion table, the `completion` usage line and error messages, and the installer's completion messages, then closes the three `Open — settled by #427` markers. No code changes here: #429 and #430 build against this text, and #428 tests it.

## Context

Epic #424 (bash completion for the `kerghan` client). #425 created the folder, and #426 (merged) settled the word-list sources. #427 settles the three remaining non-test markers: `completion.md#per-position-table`, `command.md#messages-and-exit-codes` and `install.md#messages`.

Decisions made in the issue:

- **Trailing space:** register with `complete -o nospace -F _kerghan kerghan`. `_kerghan` appends a space to every candidate except `KEY=`, because bash 3.2 has no `compopt`. `-o default`, `-o bashdefault` and `-o filenames` stay forbidden.
- **`configure` combinations** mirror `configure`'s usage errors:
  - A write (`KEY=…`, `KEY=-`, `--unset`) or `--force` on the line hides `--show-secrets`.
  - `--show-secrets` hides `--force`, `--unset` and `KEY=`.
  - A bare `KEY` is never offered.
- **Errors** use the client's quoted style, through `usage_error` (exit `2`):
  - `missing shell (supported: bash)`
  - `unsupported shell '<x>' (supported: bash)`
  - `unknown option '<x>'` for an option-like first word
  - `unexpected argument '<x>'`
- **Usage line:** between `wizard` and `version`:
  `completion bash                 print the bash completion script (load it with: eval "$(kerghan completion bash)")`.
- **Installer:**
  - A success `info` line: `bash completion installed to <file>`.
  - A two-line `hint:` with `source "<file>"` when bash-completion isn't found at a fixed list of known paths.
  - A `warning:` per failure (create dir, client run, write), each ending `; skipping bash completion`.
  - Silent with `KERGHAN_COMPLETION=false`.

## Steps

- [01 — completion.md: per-position table and registration](plan/01-completion-table.md)
- [02 — command.md: usage line and error messages](plan/02-command-messages.md)
- [03 — install.md messages, contracts.md alias line, README](plan/03-install-contracts-readme.md)

## Notes

- Docs only. No CI job checks `docs/agents/specs/`, so verify by reading:
  - every relative link must resolve;
  - `grep -rn 'settled by #427' docs/agents/specs/auto-complete/` must print nothing;
  - the `#428` markers must stay.
- Keep the folder's style: short rules, links between files, a "Required tests" list per file. Add test bullets for the new rules, but don't define #428's harness.
- Copy the message text verbatim from the issue. #429 and #430 tests compare bytes.
- Edit only `docs/agents/specs/auto-complete/`. `docs/agents/standalone.md` and the client's `usage` are #431's and #429's job.
