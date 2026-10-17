# model.md

Define the data model and status lifecycle in `docs/agents/specs/user-approval/model.md`.

- **`auth_users.status`:** `pending` | `approved` | `denied`, NOT NULL. Describe it as a
  decision (column, allowed values, default for new rows set by the service from the flag), not
  as TypeORM code.
- **Transitions:** `pending → approved` (approve, strict); any status `→ denied` (deny, lenient;
  covers reject and ban); `denied` is final; status changes only through approve and deny (admin
  edit never changes it).
- **Migration:** adds the column and backfills every existing user to `approved` in the same
  deploy — mandatory, because the gate is always enforced.
- **Registration:** status driven by `KERGHAN_USER_APPROVAL_REQUIRED` (pointer to README);
  no automatic status changes when the flag flips.
- **Default user:** `status` becomes a managed field — forced to `approved` at boot sync
  (`docs/agents/modules/auth/default-user.md`).
- **Demo seed users:** created `approved`.
- **Required tests:** migration backfill, registration status with the flag off/on, default user
  forced back to `approved`, demo seeds approved, transition rules (approve only from pending,
  deny from any status, nothing out of denied).

## Files to Change
- `docs/agents/specs/user-approval/model.md` — new: status model, transitions, migration,
  registration, default user, seeds, required tests.
