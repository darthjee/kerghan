# Verify

Manual consistency pass over every edited file (no code, no CI job):

- Every link and anchor between spec files resolves (headings renamed in `model.md` are updated in the files that point at them).
- Every remaining open question names an owner issue (#487, #488, #490, #491, #493, #494, #489) or says "not decided" with the reason; none names #486.
- Each "Required tests" section matches the rules in its file; `model.md` has a test per edge-case row.
- The columns, types, lengths and index names agree between `model.md`, `projects.md`, `github-link.md` and `sync.md` (title 256, body 65536 characters, name 100, description 2000).
- No real tokens, secrets, personal data or private repository names; "project" vs "GitHub Project" used correctly.
- `git diff --stat` shows only files under `docs/agents/specs/`.

## Files to Change

- None expected; fix any inconsistency found in the file concerned.
