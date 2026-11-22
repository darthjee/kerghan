# Review checklist walk and docs

Walk each item of the `security` and `data-access` checklists in `docs/agents/specs/issues/security.md#review-checklist` over the whole Issues module and its Integrations surface. Map every item to the Required test that verifies it, a spec file and test name, and close any item with no test by adding it here. Record the mapping as a short table in `docs/agents/specs/issues/testing.md#security-verification`, or a linked section next to it. That keeps the spec, still the source of truth until #564 folds it in, pointing at the real specs.

Update `testing.md` and `api.md` where they describe the per-controller access specs, so they name the single matrix and its completeness check. Note there that #563 must add the `bulk-state` row and remove E66 to E74 from the edge-case allowlist.

Then run the backend checks through docker-compose (`yarn coverage`, `yarn lint`, `yarn test:db`) and keep coverage at the configured thresholds.

## Files to Change
- `docs/agents/specs/issues/testing.md`: the checklist-to-test mapping, and the matrix and allowlist notes.
- `docs/agents/specs/issues/api.md`: the `#required-tests` wording, if it names the per-controller specs.
- Any spec added to close a checklist gap.
