# Sync rule in contributing.md

In `docs/agents/contributing.md`, "Definition of Done for PRs", add a bullet:

> Any PR that adds or changes a `kerghan` client command, flag, `configure` key or fixed value updates the bash completion in the same PR. The sync tests in `standalone/test/completion_sync.bats` fail otherwise; see [Client completion](standalone/client-completion.md#sync-rule).

Use the anchor that step 01 actually produces for the sync-rule section.

## Files to Change

- `docs/agents/contributing.md`: add the sync-rule bullet.
