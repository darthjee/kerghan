# Update env samples and docs

Add `KERGHAN_EMAIL_METHOD=native` to the email block in `.env.dev.sample`, right after the
existing `KERGHAN_EMAIL_*` vars. Add a matching row to `docs/agents/environment-variables.md`:
`KERGHAN_EMAIL_METHOD` — Consumed, optional, default `native`, source
`backend/src/mail/mail.config.ts`.

`.env` is gitignored (`make setup` copies it from `.env.dev.sample`) and does not exist in a
fresh checkout — it's a local, untracked, per-developer file, so there is nothing to commit here.
If a local `.env` happens to exist with a stale Django-style email block (`EMAILS_ENABLED` /
`EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` / `EMAIL_USE_TLS` /
`DEFAULT_FROM_EMAIL`), rename it to the `KERGHAN_EMAIL_*` names the code actually reads and add
`KERGHAN_EMAIL_METHOD=native` — but treat this as a local, best-effort cleanup, not a plan
deliverable to commit.

Rewrite the **API** section of `docs/agents/modules/mail.md` for `sendEmail`/`SendEmailResult`
(replacing the old `send`/`SendMailResult` shape), and add a **Send methods** section describing
the `native` method, the registry, `KERGHAN_EMAIL_METHOD`, and the fail-fast validation (both at
boot for an unknown configured method and per-call for an unknown `method` param).

## Files to Change

- `.env.dev.sample` — add `KERGHAN_EMAIL_METHOD=native`.
- `docs/agents/environment-variables.md` — new `KERGHAN_EMAIL_METHOD` row.
- `docs/agents/modules/mail.md` — rewritten API section + new Send methods section.
