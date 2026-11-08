# model.md: the GitHub handle section and the sync-state column

Rewrite `## GitHub handle` in `model.md` with the decisions from [plan.md](../plan.md): column
(type, nullability, no index and why), normalisation order, validation regex and error, URL
encoding, how it is set (`PATCH /auth/account.json` handle-only path, the
`currentPassword`-only-with-managed-fields rule, the mixed edit, the response), the new
`POST /auth/account/mine.json` read, the narrowed default-user block and the replaced rationale,
admin endpoints unchanged, the Auth export used by Repositories, and the handle-change
reconciliation (subsection "Handle changes"). Remove the "Open — settled by #449" note.

Add `handle varchar(39) NULL` to the `repositories_sync_states` row of the tables overview and
its bullet list. Update the "When" bullet of "Private metadata lifecycle" so the handle case
points at the reconciliation instead of "right after". Add the "Required tests" for every rule
(validation accept/reject cases incl. `@`, case, 39/40 chars, double/leading/trailing hyphen;
handle-only edit without password, skipping lockout and counter; mixed edit; default user
handle-only `200`, mixed `409` nothing applied; admin edit with `githubHandle` `400`; `mine.json`
shape; reconciliation drops and prunes; cleared handle; unchanged handle is a no-op).

## Files to Change

- `docs/agents/specs/repos/model.md` — GitHub handle section, sync-state column, pruning "When",
  required tests.
