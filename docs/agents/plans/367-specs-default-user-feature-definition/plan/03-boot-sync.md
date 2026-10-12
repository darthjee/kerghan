# boot-sync.md

Create `docs/agents/specs/default-user/boot-sync.md` (implemented by #369).

At boot, when `isEnabled()` is true:
- **No user with the configured username:** create it with username, email, password and admin flag.
- **The user exists:** overwrite email, password and admin flag. The environment is the source of truth.
- **Password:** rehash only when the configured password differs from the stored one (`bcrypt.compare`). When it actually changes, revoke the user's sessions, consistent with `ADMIN_PASSWORD_CHANGE`.
- **Email collision:** if the configured email belongs to another user, fail at boot with a clear error.
- **Race between instances:** if the insert hits the unique constraint, fall through to the update path.

When `isEnabled()` is false, nothing happens and an existing default user stays untouched.

**Edit blocking:** while `isEnabled()` is true, edits of the default user's username, email, password and admin flag are blocked, both through `account.json` and through the admin endpoints. Business logic stays in services. Leave the placeholder: "HTTP status, error code and response body: to be defined by #374; do not implement before then."

**Required tests:**
- create, update, and unchanged password (no rehash);
- password change with revocation;
- email collision, the race, and the disabled flag;
- blocked edits through each path.

## Files to Change
- `docs/agents/specs/default-user/boot-sync.md`: new.
