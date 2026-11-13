# Docs and spec sync

- **`docs/agents/specs/repos/api.md#add-rate-limit`:** replace "following the abuse-guard services in `backend/src/auth/`" with the in-memory decision. The limit is a per-process, per-user fixed window read through the shared `Clock`, with no table. It resets on restart, and each instance counts on its own. Keep the env-var table, and say the vars are now listed in `environment-variables.md`.
- **`docs/agents/specs/repos/api.md#errors`:** note that `error.retryAfterSeconds` is now emitted by the filter. Folding it into `architecture/backend.md` stays #452's.
- **`docs/agents/environment-variables.md`:** an explicit exception to the Epic's "no permanent docs" rule, decided in the issue. Add every `KERGHAN_REPOSITORIES_*` var read by the code, with its default and meaning. That covers the two Add vars and the sync vars in `repositories-config.ts`: `KERGHAN_REPOSITORIES_SYNC_TTL_MS`, `_COOLDOWN_MS`, `_PAGE_CAP`, and any lease, deadline or parallelism keys it reads. Follow the file's existing format.
- **`docs/agents/specs/repos/README.md`:** add #464's row to the "Sub-issues" table.
- **Spec gaps:** if implementation shows a gap or error in `api.md`, `security.md` or `testing.md`, fix the spec in this PR and list the change in the PR description.

## Files to Change

- `docs/agents/specs/repos/api.md`
- `docs/agents/environment-variables.md`
- `docs/agents/specs/repos/README.md`
