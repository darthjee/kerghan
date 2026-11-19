# Verify
- `wc -l docs/agents/environment-variables.md docs/agents/environment-variables/*.md`: every file under 300 lines.
- Content preserved: diff the concatenation of the moved sections against the original (`git show HEAD:docs/agents/environment-variables.md`) ignoring link edits.
- Link check: grep that no remaining link targets a removed anchor (`#1-backend-...`, `#5-standalone-...`, `#default-user-values-...`, `#rotating-...`, `#setting-...`) on the hub, and that every relative link in the new pages resolves to an existing file.
- No CI job runs on docs-only changes beyond what already exists; no commands via the host runtime are needed.

## Files to Change
- None (verification only).
