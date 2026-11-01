# Verify no link points to the removed specs
Run `git grep -n "specs/client-update"` and confirm the only hits are in `docs/agents/issues/` and `docs/agents/plans/` (historical artifacts). Check that every anchor used by the new links (`client-update.md#...`) exists. Run the bats suite to confirm the comment-only edits changed nothing.

## Files to Change
- none (verification only)
