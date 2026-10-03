# Delete the spec and verify

- Delete `docs/agents/specs/integrations/` (all 9 files).
- In `docs/agents/specs.md`, replace the integrations row of **Active specs** with "none". Keep
  the hub and the hub's link from `docs/agents/index.md`.
- Check `.markdownlintignore` and `.codacy.yml` for spec-path entries, and remove any that
  exist.
- Run the grep from `plan.md`'s Notes. It must be empty outside `docs/agents/issues/` and
  `docs/agents/plans/`, after the backend and frontend changes land.
- Ask the `product-owner` agent to confirm that `product.md` matches what was built.

## Files to Change
- `docs/agents/specs/integrations/**`: deleted
- `docs/agents/specs.md`: Active specs reads "none"
