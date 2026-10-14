# Remove the spec folder and update the hub

- Delete `docs/agents/specs/default-user/` (all seven files).
- In `docs/agents/specs.md`:
  - Set "Active specs" to "none".
  - Add a "Default user" row to "Completed specs". Point it to
    `modules/auth/default-user.md`, `backend/routes/auth.md` (`status.json`, `409`),
    `environment-variables.md` section 1 and section 5, and `standalone.md` (`auto-login`,
    `bind`, `update-env`, effective client IP). Product decision: #366.
- Check the result: `grep -rn "specs/default-user" docs AGENTS.md CLAUDE.md .claude` returns
  nothing outside `docs/agents/issues/` and `docs/agents/plans/`. Also check that
  `.claude/agents/*.md` do not link to the folder.

## Files to Change
- `docs/agents/specs/default-user/` — deleted.
- `docs/agents/specs.md` — hub entry moved to "Completed specs".
