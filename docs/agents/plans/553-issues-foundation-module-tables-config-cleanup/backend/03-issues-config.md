# IssuesConfig and environment variables

An injectable `IssuesConfig` that reads the nine keys of `sync.md#configuration` once, each through `getPositiveIntConfig`. Each default is an exported constant:

| Key | Default | Field |
|---|---|---|
| `KERGHAN_ISSUES_SYNC_MAX_RETRIES` | 5 | `syncMaxRetries` |
| `KERGHAN_ISSUES_SYNC_COOLDOWN_MS` | 30000 | `syncCooldownMs` |
| `KERGHAN_ISSUES_SYNC_STALE_AFTER_SECONDS` | 3600 | `syncStaleAfterSeconds` |
| `KERGHAN_ISSUES_MAX_PROJECTS_PER_USER` | 100 | `maxProjectsPerUser` |
| `KERGHAN_ISSUES_MAX_ISSUES_PER_PROJECT` | 5000 | `maxIssuesPerProject` |
| `KERGHAN_ISSUES_LINK_MAX_PER_WINDOW` | 30 | `linkMaxPerWindow` |
| `KERGHAN_ISSUES_LINK_WINDOW_MS` | 60000 | `linkWindowMs` |
| `KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW` | 120 | `editMaxPerWindow` |
| `KERGHAN_ISSUES_EDIT_WINDOW_MS` | 60000 | `editWindowMs` |

Unit spec, modelled on `repositories-config.spec.ts`: for each key, the default when the key is unset or invalid (`0`, negative, fractional, non-numeric), and the value when it is valid.

Document the nine keys in `docs/agents/environment-variables.md` in the same change, in the style of the Repositories keys: name, default, validation and purpose. Do not touch `modules/workers.md`: #553 adds no job.

## Files to Change
- `backend/src/issues/issues-config.ts` — new.
- `backend/src/issues/tests/issues-config.spec.ts` — new.
- `docs/agents/environment-variables.md` — add the nine keys.
