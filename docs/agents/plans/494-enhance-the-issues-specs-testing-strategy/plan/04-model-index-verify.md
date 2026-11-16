# Align model.md and the index, then verify

- `model.md`: cross-link its DB-backed "Required tests" to testing.md's tier table and the restart spec; update the "feed #494" wording to say the strategy is decided.
- `specs/issues.md`: update the index row and the order note if needed (testing is no longer "open"); `specs.md` needs no change.
- Verify: every relative link in the changed files resolves (`grep -o '](.*\.md[^)]*)'` plus a path check); every anchor used exists; `testing.md` has no unresolved open question without an owner issue; every E-id cited exists in edge-cases.md; no code, migration or endpoint was added (`git diff --stat` shows only `docs/`).

## Files to Change

- `docs/agents/specs/issues/model.md` — cross-links and wording.
- `docs/agents/specs/issues.md` — index row if needed.
