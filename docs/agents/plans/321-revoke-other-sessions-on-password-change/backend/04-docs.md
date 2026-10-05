# Update docs
In `docs/agents/modules/auth.md`, next to the "Logout" bullet in the refresh-token section, add
a "Password change" bullet covering these points:
- A password-recovery reset revokes all of the user's refresh tokens.
- A My Account password change (`PATCH /auth/account.json`, optional `refreshToken` in the
  body) revokes all the user's other tokens. It keeps the presented token only if that token is
  the caller's active one, and otherwise revokes all of them.
- An admin password edit revokes all of the target user's tokens.
- Access tokens that were already issued stay valid until they expire, the same caveat as logout.

Grep `docs/` for any other text describing the old "My Account leaves other sessions active"
behavior and update it.

## Files to Change
- `docs/agents/modules/auth.md` — document the revocation rules.
