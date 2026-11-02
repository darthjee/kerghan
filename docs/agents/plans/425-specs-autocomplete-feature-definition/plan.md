# Plan: Specs: autocomplete feature definition

Issue: [425-specs-autocomplete-feature-definition.md](../../issues/425-specs-autocomplete-feature-definition.md)

## Overview

Write the bash autocomplete feature specs under `docs/agents/specs/auto-complete/` as six files: `README.md`, `command.md`, `completion.md`, `install.md`, `contracts.md` and `security.md`. Then list the feature under "Active specs" in `docs/agents/specs.md`. This is docs only. The architect writes it, and the standalone agent reviews the parts that touch the client's and the installer's existing behaviour. Decisions owned by #426, #427 and #428 appear as explicit open markers.

## Context

- Epic #424 holds every decision: Scope, `install.sh` completion setup, Edge cases 1–19, Backward compatibility 1–9, and Performance & security 1–9. The issue file's mapping table says which file each decision goes into.
- Precedent: the client update specs (#415, commit `09844c0`), the same six-file shape with "Required tests" sections. They were folded into `docs/agents/standalone/client-update.md`, which is the model for tone and structure.
- Facts about the client today (`standalone/bin/kerghan`), used by `completion.md`:
  - Commands: `up`, `down`, `logs`, `status`, `compose`, `reset`, `update`, `update-env`, `configure`, `wizard`, `version`, plus `help` / `-h` / `--help` (accepted at the top level only; subcommands take no help flag).
  - Flags per command:
    - `up`: `--offline`, `-p`/`--port PORT`, `--auto-login`, `--no-auto-login`, `--bind ADDRESS`, `-f`
    - `logs`: `-f`
    - `update`: `[VERSION]`, `--force`, `--yes`, `--restart`, `--no-restart`; `--finish` is hidden
    - `configure`: `--show-secrets`, `--force`, `--unset KEY`, `KEY=VALUE`, `KEY=-`, `[KEY]`
    - `wizard`: `--advanced`
    - Every other command takes none.
  - Config keys: `port`, `variant`, `runtime`, `stop-timeout`, `image-tag`, `auto-login`, `bind`, `restart-on-update`. Env keys (uppercase, go to `kerghan.env`): `DEFAULT_ENV_KEYS`.
  - The client must stay compatible with bash 3.2, and runs under `set -euo pipefail`.
- `install.sh` contract (its header): no prompts, no sudo, `mv -f` as the only write, never touches `~/.kerghan`; default install dir `~/.local/bin`.

## Steps

- [01 — README.md](plan/01-readme.md)
- [02 — command.md](plan/02-command.md)
- [03 — completion.md](plan/03-completion.md)
- [04 — install.md](plan/04-install.md)
- [05 — contracts.md](plan/05-contracts.md)
- [06 — security.md](plan/06-security.md)
- [07 — Active specs entry](plan/07-active-specs-entry.md)
- [08 — Standalone review and PR description](plan/08-review-and-pr.md)

## Notes

- **Open marker format:** `> **Open — settled by #NNN:** <what>`. Markers go in:
  - `completion.md`: word-list source → #426; exact per-position table → #427.
  - `command.md` and `install.md`: verbatim messages, exit codes and the `completion` usage line → #427.
  - Every "Required tests" section: harness and full coverage → #428.
- No separate `docs/agents/specs/auto-complete.md`: the hub is `docs/agents/specs.md`.
- Out of scope: any code, the permanent docs (including `docs/agents/standalone.md`'s out-of-scope list), zsh/fish. These belong to #429–#431 or later Epics.
- If a #424 decision turns out to conflict with the client's current behaviour, adjust it in the spec and call it out in the PR description. Do not stop to ask.
- There's no CI check specific to docs. Markdown links between the new files must resolve.
