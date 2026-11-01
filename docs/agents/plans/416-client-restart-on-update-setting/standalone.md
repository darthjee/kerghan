# Standalone Plan: Client: `restart-on-update` setting

Main plan: [plan.md](plan.md)

## Overview
Add the `restart-on-update` key to `standalone/bin/kerghan` following the spec in [`docs/agents/specs/client-update/setting.md`](../../specs/client-update/setting.md), which is the source of truth for every label, message and verbatim text below. Nothing reads the key yet: `kerghan update` (#414's next sub-issue) is its only consumer.

## Context
- Config keys live in `CONFIG_KEYS` (listing order) and are wired through `load_config` (`CFG_*` globals, `config_invalid`), `valid_config_value`, `config_expected` and `config_default`. `read_config_file`, `setting_lookup`, the `configure` listing/read/set/unset and `wizard_config_question` all iterate or dispatch on those, so most of `configure` comes for free once the helpers know the key.
- `batch_apply_hint` currently picks between `Run 'kerghan up' to apply ...` and `Run 'kerghan down && kerghan up' to apply.`; it needs a third, weakest outcome for a batch whose only change is `restart-on-update`.
- `wizard_questions` asks `bind` unconditionally; the new question goes right after it, also unconditionally (not behind `wizard_asks_config`).
- The client must stay bash 3.2 compatible (see the header comment of `standalone/bin/kerghan`).

## Steps

- [01 — Parser and shared config helpers](standalone/01-parser-and-helpers.md)
- [02 — `configure` apply hint](standalone/02-configure-apply-hint.md)
- [03 — `wizard` question](standalone/03-wizard-question.md)
- [04 — Usage, header comment and `config.example`](standalone/04-usage-and-config-example.md)
- [05 — Bats tests](standalone/05-bats-tests.md)

## CI Checks
- `standalone`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`, `bats standalone/test`)

## Notes
- Out of scope: `kerghan update` and its `--restart` / `--no-restart` flags (next sub-issue), and folding the spec into `docs/agents/standalone/client-config.md` (last sub-issue of #414). Do not edit the permanent docs here.
- The `usage` line for the key is two columns wider than the others; the spec accepts this, so do not realign the other lines.
- Older clients warn `unknown key 'restart-on-update' (ignored)`; this is accepted per the spec, nothing to do.
- Run bats only through `docker-compose` (never on the host).
