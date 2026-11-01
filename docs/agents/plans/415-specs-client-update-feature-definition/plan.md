# Plan: Specs: client update feature definition

Issue: [415-specs-client-update-feature-definition.md](../../issues/415-specs-client-update-feature-definition.md)

## Overview

This is a docs-only issue: write the temporary feature specs for `kerghan update [VERSION]` and the `restart-on-update` setting under `docs/agents/specs/client-update/`, and register them under "Active specs" in `docs/agents/specs.md`. The specs write down every decision from the Epic (#414) and the decisions settled in #415, so #416 (setting), #417 (command) and #418 (fold) build against one definition. No code changes.

## Context

- Lifecycle and conventions are in `docs/agents/specs.md`: one folder per feature, a `README.md` holding the overview, scope, product decision and index, files split by concern, and a "Required tests" section at the end of each spec file. Specs describe decisions, not code; they name existing code only to point at a convention.
- Precedent: the client config specs (#403), now folded into `docs/agents/standalone/client-config.md`. Follow their tone and their level of detail for exact messages and usage lines.
- The client lives in `standalone/bin/kerghan`. The specs refer to its existing conventions: `error`/`warn`/`hint` message prefixes, `CONFIG_KEYS`, the `valid_*` / `config_invalid` validation helpers, the `wizard_questions` order, `cmd_update_env`, `write_file_atomic`, `cmd_up`'s upgrade, downgrade and non-release-image handling (`standalone/test/upgrade.bats`), and `KERGHAN_VERSION`, the pinned version stamped by `scripts/bump_version.sh`.
- The installer is `standalone/install.sh`: `KERGHAN_VERSION`, `KERGHAN_INSTALL_DIR`, the stamp line `KERGHAN_VERSION="x.y.z"`, `check_docker`, staging plus `mv -f`, and `ensure_vault`.
- The full decision list is in the issue file: the Description, Solution → Settled decisions, Spec layout, and Additional edge cases. The Epic's edge cases, backward compatibility, and performance & security sections are in #414's body.

## Steps

- [01 — Feature README and Active specs entry](plan/01-readme-and-hub-entry.md)
- [02 — setting.md: `restart-on-update`](plan/02-setting.md)
- [03 — versions.md: validation, resolution and comparison](plan/03-versions.md)
- [04 — contracts.md: handoff, installer and release files](plan/04-contracts.md)
- [05 — command.md: `kerghan update [VERSION]`](plan/05-command.md)
- [06 — security.md: trust model and safe execution](plan/06-security.md)
- [07 — Consistency pass and standalone review](plan/07-consistency-and-review.md)

## CI Checks

- There are no doc-specific CI jobs (CircleCI runs backend, frontend and proxy tests and lint, plus the release chain). Check the Markdown by hand: relative links resolve, and anchors match the headings.

## Notes

- Keep every decision from #414 and #415 unless the client's current behaviour makes one impossible. In that case, adjust it in the spec and call it out in the PR description, without stopping to ask.
- `FIRST_UPDATE_VERSION` is defined, not given a number: "the first release that contains `update`". #417 sets the constant.
- The PR description must confirm that no installer sub-issue is needed (or name the blocker that requires one).
- Do not edit #416, #417 or #418, `standalone/config.example`, `docs/agents/standalone.md` or `README.md`.
