# security.md and README

## security.md

Reword rule 5 under `### Fixed text`:

- The emitted script is fixed text **for a given client version**. It's built only from the client's own constants (see [completion.md](completion.md#word-lists)), and never interpolates environment variables, config values, `$HOME`, the current directory or any path.
- Keep "Two runs with different environments print the same bytes."
- `## Required tests` already has the matching test (same output with different `HOME`, `PWD`, …), so add nothing there.

## README.md

- **Sub-issue map:** add a row for #434, "Client: completion word-list constants (refactor, no behaviour change)". It reads [completion.md](completion.md#word-lists) and [contracts.md](contracts.md#sync-rule).
- **Order line:** change it to #425 → #426 → #427 → #428 → #434 → #429 → #430 → #431. Note that #434 changes the client, not this folder, so it doesn't count toward the one-at-a-time rule for spec sub-issues, but it must merge before #429.
- **Who reads what:** add #434 (reads `completion.md` and `contracts.md`). Also note that #429 depends on #434.
- **Open markers table:** remove the two #426 rows, `completion.md#word-lists` and `contracts.md#sync-rule`.
- **Index:** the `contracts.md` row already lists "the sync rule", so it needs no change.

## Files to Change
- `docs/agents/specs/auto-complete/security.md` — reword rule 5.
- `docs/agents/specs/auto-complete/README.md` — #434 in the sub-issue map, the order line and "Who reads what"; remove the two #426 open-marker rows.
