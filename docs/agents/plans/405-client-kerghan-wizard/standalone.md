# Standalone Plan: Client: `kerghan wizard`

Main plan: [plan.md](plan.md)

## Overview
Implement `cmd_wizard` in `standalone/bin/kerghan` exactly as specified in
`docs/agents/specs/client-config/wizard.md`, with the shared rules of `files.md` and
`security.md` in the same folder. Where the spec and this plan disagree, the spec wins. Cover
every item in the spec's "Required tests" list with a new bats file.

## Context
- #404 already provides, in `standalone/bin/kerghan`:
  - `is_tty`, which honors `KERGHAN_ASSUME_TTY=true`;
  - `read_settings` / `setting_lookup`, which give the effective value, the source and
    `file, invalid` for a bad config line, plus the derived `auto-login` and `bind`;
  - `validate_value`, which holds the per-key rules, including the 8-character password
    minimum and the `FRONTEND_BASE_URL` scheme;
  - the batch arrays with `batch_reset` / `batch_add` / `batch_validate` / `key_changes` /
    `setting_display`;
  - `batch_apply`, which writes atomically and creates `kerghan.env` the same way `up` does;
  - `batch_report` (the change list, the apply hint, the password note and
    `cross_key_warnings`);
  - `default_env_value KERGHAN_DEFAULT_USER_PASSWORD` (`openssl rand -hex 24`), `volume_exists`
    and `CR_NOEQ_LINES`.
- The wizard adds **no second write path**. Every write goes through `batch_add` and then
  `batch_validate` and `batch_apply`.
- The file must stay compatible with bash 3.2: no associative arrays, no `${var,,}`, no
  `mapfile`.

## Steps

- [01 — Prompt helpers](standalone/01-prompt-helpers.md)
- [02 — `cmd_wizard` flow and questions](standalone/02-wizard-flow.md)
- [03 — Summary, confirmation and write](standalone/03-summary-and-write.md)
- [04 — bats tests](standalone/04-bats-tests.md)

## CI Checks
- `standalone/`: `docker run --rm -v "$PWD":/code -w /code bats/bats:1.11.0 standalone/test`
  (CI job: the standalone bats job, `bats standalone/test`). Never run bats on the host.
- Run shellcheck on `standalone/bin/kerghan` through Docker (for example the
  `koalaman/shellcheck` image), the same way #404 cleared its findings.

## Notes
- **An invalid config line for a question only asked with `--advanced`** (e.g. a bad `runtime`
  line, run without `--advanced`): `batch_validate` refuses the whole batch unless the batch
  fixes that line. To keep the write from failing after confirmation, the wizard also asks
  that key's question in its table position, even without `--advanced`, whenever its current
  line is invalid. The spec does not address this case, so record the choice in a code
  comment and in the PR description so #406 can document it.
- The summary marks a generated password as `KERGHAN_DEFAULT_USER_PASSWORD: changed (generated)`
  (security.md). The Required tests line only says `changed`. Assert the prefix and that the
  value never appears.
- Bats fixtures with literal typed passwords may need a `.gitguardian.yaml` ignore entry, as
  #404 needed for its configure fixtures.
