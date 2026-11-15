# Register the feature in specs.md

Edit `docs/agents/specs.md` only.

- **Conventions:** change the "One `README.md` per feature" rule to allow, as an exception, an index file beside the folder (`docs/agents/specs/<feature>.md` plus `docs/agents/specs/<feature>/*.md`, used by the Issues feature). State that for this layout the fold step deletes both the index file and the folder.
- **Lifecycle:** where step 4 says the last sub-issue deletes `docs/agents/specs/<feature>/`, make it cover the index file in that layout.
- **Active specs:** replace "None." with an entry for Issues and Projects: link to `specs/issues.md`, epic #483, and a one-line description. Keep the rule that the list reads "None." when nothing is active.

## Files to Change
- `docs/agents/specs.md` — the Conventions exception, the lifecycle wording and the *Active specs* entry.
