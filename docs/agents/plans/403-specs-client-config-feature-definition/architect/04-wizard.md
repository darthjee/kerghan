# wizard.md
Write `docs/agents/specs/client-config/wizard.md`: the `kerghan wizard` command.

Sections:
- **Usage** — exact synopsis (`wizard [--advanced]`), copied verbatim by #405.
- **Questions** — ordered list: port, variant, auto-login, bind (default depends on
  auto-login), default user username, email, password. `--advanced` adds `runtime`,
  `stop-timeout`, `image-tag`, `KERGHAN_DEFAULT_USER_ENABLED`, `KERGHAN_DEFAULT_USER_ADMIN` and
  the public URL (`FRONTEND_BASE_URL`, `[http://localhost:<port>, derived from port]`). State
  where the advanced questions go in the order. Skip username / email / password when
  auto-login is off and `ENABLED=false`.
- **Prompts** — bracket default = current value (or default), Enter keeps it, invalid answer
  re-asks, invalid current value shown as invalid and the default offered; example transcript.
- **Password** — (k)eep / (g)enerate (same generator as `up`, never printed, says it is in
  `kerghan.env`) / (t)ype (hidden, twice, re-ask on mismatch).
- **Summary and confirmation** — change list (secrets as `<KEY>: changed`), `[Y/n]`, "n" prints
  `Nothing written.` and exits 0; then the apply hint.
- **Abort and no TTY** — Ctrl-C / end of input before confirmation writes nothing (130 on
  Ctrl-C); no TTY → exit 1 pointing to `kerghan configure`. Running instance: nothing special.
- **Never asked** — `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY`, custom env variables.
- **Required tests** — one line per scenario, answers fed through stdin (note how the no-TTY
  rule and stdin-fed tests coexist: settle the TTY check so bats can drive the wizard, e.g. a
  test-only override or checking stdin vs. `/dev/tty`; record the decision).

## Files to Change
- `docs/agents/specs/client-config/wizard.md` — new.
