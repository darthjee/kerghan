# Plan: Specs: autocomplete — single source of truth for completion word lists

Issue: [426-specs-autocomplete-single-source-of-truth-for-completion-word-lists.md](../../issues/426-specs-autocomplete-single-source-of-truth-for-completion-word-lists.md)

## Overview

A spec-only change to `docs/agents/specs/auto-complete/`. It records where each completion word list comes from and how the sync rule is enforced, then closes the two `Open — settled by #426` markers. Config keys, env keys and the fixed values are generated from client constants. Commands and per-command flags are hand-written in `_kerghan` and guarded by sync tests. The client refactor that adds the missing constants is #434. No code changes here.

## Context

Epic #424 (bash completion for the `kerghan` client). #425 created the spec folder and left decisions to later sub-issues as `> **Open — settled by #NNN:**` markers. #426 settles two of them: `completion.md#word-lists` and `contracts.md#sync-rule`.

The decisions, made in the issue, are:

- **Generated** (by `kerghan completion bash`, from client constants):
  - config keys from `CONFIG_KEYS`;
  - env keys from `DEFAULT_ENV_KEYS` plus a new constant holding `FRONTEND_BASE_URL`;
  - the four fixed-value sets from new value constants.

  #434 adds those constants and makes the `valid_*` validators and their messages read them.
- **Hand-written** in `_kerghan`: commands and per-command flags. A `case` pattern can't take its alternatives from a variable, so constants wouldn't drive dispatch.
- **Rejected:** generating everything (rewrites every parser, and the `case` patterns remain a second copy) and hand-writing everything (gives up what the constants already guarantee).
- **Sync tests** (what they check; #428 defines how):
  - source the client (relying on its `BASH_SOURCE` guard) and compare the generated lists with the constants;
  - cross-check `kerghan help` against the hand-written commands and flags, expanding `--[no-]x`, counting aliases, and skipping a commented exclusion list (`--finish`);
  - check that every `CONFIG_KEYS` entry is either in `FREE_FORM_KEYS` (`port`, `bind`, `image-tag`, `stop-timeout`) or has a value constant.
- **Edge cases** 1–8 from the issue: hidden words, aliases, `--[no-]x`, env keys (`CLIENT_MANAGED_KEYS` never offered), the derived `--unset` list, fixed vs free-form, positional arguments, and sets compared without order.
- **Backward compatibility:** the new constants are not contracts; the `BASH_SOURCE` guard is an internal test contract; the script's content still changes freely between versions.

## Steps

- [01 — completion.md: word-list sources](plan/01-completion-word-lists.md)
- [02 — contracts.md: sync-rule enforcement](plan/02-contracts-sync-rule.md)
- [03 — security.md and README](plan/03-security-and-readme.md)

## Notes

- Docs only. No CI job checks `docs/agents/specs/`, so verify by reading. Every relative link must resolve, and `grep -rn 'settled by #426' docs/agents/specs/auto-complete/` must print nothing.
- Keep the folder's style: short numbered or bulleted rules, links between files, a "Required tests" list per file. Don't restate #428's harness.
- #434 must merge before #429. The spec states that ordering, but #426 itself doesn't depend on #434.
- Edit only `docs/agents/specs/auto-complete/`. `docs/agents/standalone.md` is #431's job.
