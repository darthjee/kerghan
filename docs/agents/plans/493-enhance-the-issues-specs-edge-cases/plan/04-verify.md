# Verify

Documentation-only check.

- Every relative link and anchor in the edited files resolves (matrix rows, `projects.md#edge-cases`, `model.md#edge-cases`, the Repositories matrix reference).
- Every `- [ ]` item in the edited files names an owner issue, except the per-field timestamps item, which says it has none yet.
- Row ids `E1…En` are unique and every row has an owner, a check and a status.
- No real tokens, secrets, personal data or private repository names; "project" always means Kerghan's.
- Only files under `docs/agents/specs/` changed, and no code, migrations or endpoints were added.

## Files to Change
- None; fix whatever the checks find in the files above.
