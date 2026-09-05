# Document KERGHAN_LOG_LEVEL

Add the new environment variable to the project's environment-variable references, following the
existing `KERGHAN_*` documentation convention (see `KERGHAN_EMAILS_ENABLED`'s row for the closest
precedent: **Consumed**, optional, with a stated default).

## Files to Change

- `docs/agents/environment-variables.md` — add a row to the "Backend application runtime" table:
  `KERGHAN_LOG_LEVEL` | **Consumed**, optional | Log-level threshold (`debug`/`info`/`warn`/
  `error`) for the new Core logger service; defaults to `info` when unset. |
  `backend/src/core/logger.service.ts`.
- `.env.dev.sample` — add `KERGHAN_LOG_LEVEL=info` (or leave unset with a comment, matching how
  other optional/defaulted vars are documented there) so local dev's sample stays in sync with
  this doc, per `environment-variables.md`'s own "Keeping this doc honest" rule.
