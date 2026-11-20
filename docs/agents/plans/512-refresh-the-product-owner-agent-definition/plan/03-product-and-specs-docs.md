# Product and specs doc updates

Three small doc edits that keep the map current over time:

1. **`docs/agents/product.md`, "Once the data model is decided"**: remove the bullet "Update `.claude/agents/product-owner.md` to reference the real rules instead of 'flag by default.' (`data-access.md` already finds rules through its discovery rule.)". Keep the other bullets, including the Majora-shape rewrite note.
2. **`docs/agents/specs.md`, Lifecycle step 3** (the fold step): add that the feature's last sub-issue also updates the area's row in `.claude/agents/product-owner.md`'s map, so it points at the permanent docs instead of the spec folder.
3. **`docs/agents/specs/issues/model.md`, "Statements to rewrite at fold time"**: add a row: `.claude/agents/product-owner.md` | the Issues and Projects row of the map (switch it from `specs/issues.md` to the permanent docs).

Do not add a Definition of Done item to `contributing.md` (out of scope by decision).

## Files to Change

- `docs/agents/product.md`: remove one bullet.
- `docs/agents/specs.md`: extend Lifecycle step 3.
- `docs/agents/specs/issues/model.md`: one new fold-list row.
