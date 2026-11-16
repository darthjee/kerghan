# Align model, ui and api

- `model.md`: note that the marker's `updated_at` is the last local edit time used by E7, and that an edit changing no value creates no marker and no revision bump (E12); link the matrix from the edge-case table.
- `ui.md`: the states that must be displayed (gone, rate limited until X, sync failed with a credential reason) and the "retry sync" action; add to the open questions the exact wording and placement (#491).
- `api.md`: add the "retry sync" trigger to the open questions (#489), and how failed and rate-limited states are exposed.
- `issues.md` index: update the edge-cases row only if its concern text no longer fits.

## Files to Change
- `docs/agents/specs/issues/model.md` — marker `updated_at` meaning, no-op edit rule.
- `docs/agents/specs/issues/ui.md` — displayed states and retry action.
- `docs/agents/specs/issues/api.md` — retry-sync open question.
- `docs/agents/specs/issues.md` — index row, if needed.
