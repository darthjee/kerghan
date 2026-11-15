# Verify links, owners and content

Manual check of the whole change before finishing (no code runs).

- Every relative link resolves: the index to each of the nine files, each file back to `../issues.md`, and `specs.md` to `specs/issues.md`. Every `#open-questions` anchor linked from the index exists in the target file.
- Every `- [ ]` open question names an owner issue from the list in the plan, and that issue exists (#485 to #491, #493, #494).
- `docs/agents/specs.md` lists the feature under *Active specs*; its Conventions section allows the layout and states that the fold deletes both `issues.md` and `issues/`.
- The index explains the name collision with `docs/agents/issues/` and the temporary supersession of `product.md`'s "not persisted by default" statement.
- Every decision from the issue's "Decisions already made in the epic" appears in the file that owns it, with no extra detail and no proposed defaults.
- No real tokens, secrets, personal data or private repository names; examples use fake values.
- `git status` shows changes only under `docs/agents/specs.md`, `docs/agents/specs/` (and the plan and issue files).

## Files to Change
- None; fix any file from the earlier steps if a check fails.
