# Consistency review

A final pass over the whole folder:

- **No duplicates:** no test bullet appears in two "Required tests" sections. Search for the distinctive phrases: candidate walk, budget, redirect, zombie, `run_id`, purge, handle validation, concurrent, canary.
- **Links resolve:** every relative link and `#anchor` added or changed resolves (`testing.md`, `#required-tests`, `sync.md` anchors for the new rules).
- **Markers gone:** no `#451` reference is left, except the README sub-issues table and Order line.
- **Rules agree:**
  - `testing.md`'s rules match the owning files (`Clock`, `SyncLauncher`, no-`NOW()`, boundary tooling);
  - nothing claims the CI job, the `yarn test:db` script or the ESLint override exists yet.
- **Scope:** no file outside `docs/agents/specs/repos/` is changed (`git diff --stat`).

## Files to Change

- Any file in `docs/agents/specs/repos/` that the review finds inconsistent.
