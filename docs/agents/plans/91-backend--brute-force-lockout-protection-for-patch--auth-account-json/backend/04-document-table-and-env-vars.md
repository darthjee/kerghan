# Document the new table and env vars

Add `auth_account_edit_lockouts` to `docs/agents/architecture/backend.md`'s "Owned tables" table
(same row shape as the existing `auth_authorization_requests` entry, noting `user_id` is a logical
FK with no physical FK/cross-module JOIN).

Add `KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS` and `KERGHAN_ACCOUNT_EDIT_LOCK_MS` to
`docs/agents/environment-variables.md`'s consumed-vars table, next to the existing
`KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_*` rows, same "**Consumed**, optional" shape and default
values (`5` / `300000`).

## Files to Change

- `docs/agents/architecture/backend.md` — add the new table row.
- `docs/agents/environment-variables.md` — add the two new env-var rows.
