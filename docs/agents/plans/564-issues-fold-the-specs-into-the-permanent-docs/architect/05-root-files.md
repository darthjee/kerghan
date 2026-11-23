# Apply the approved root-file edits

Apply exactly the wording in *Approved root-file edits* of the issue file (approved by the user on 2026-11-23), and nothing else in these two files:

- `AGENTS.md`, project overview (lines 5 to 17):
  - the credentials parenthetical becomes "used by the backend to list their repositories and to sync linked issues, not for fetching issues live"
  - the sentences from "Issue data itself is fetched live" to "not the current behavior." are replaced by the approved paragraph
- `AGENTS.md`, the "lightweight per-user account" bullet (around line 109): the approved clause replaces "issue data is still read by the browser, unauthenticated (public-repo only)".
- `CLAUDE.md`, *Boundaries*:
  - the integrations bullet gets the approved linked-issue exception sentence
  - the "GitHub credentials stay in the backend" bullet gets ", and syncs linked issues with the project owner's credential"

Both files link only to `docs/agents/specs.md` (the hub), never to `modules/issues.md` (the `specs.md` rule for root files). Re-wrap the lines to the file's existing width, and change no other wording.

## Files to Change

- `AGENTS.md`: the overview paragraph and the account bullet.
- `CLAUDE.md`: two *Boundaries* bullets.
