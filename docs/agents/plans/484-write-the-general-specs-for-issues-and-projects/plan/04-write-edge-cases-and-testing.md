# Write edge-cases.md and testing.md

Create `docs/agents/specs/issues/edge-cases.md` and `docs/agents/specs/issues/testing.md`, in the same shape as the other files (intro with a link to `../issues.md`, then `## Open questions`, then `## Required tests`).

- **`edge-cases.md`** (owner #493): its purpose (a matrix of edge cases across projects, issues, the link and the sync, each with expected behavior, owning file and verifying check). Only cases already decided in the epic are rows; the rest are open questions, for example a deleted or transferred GitHub issue, a repository removed, an integration or user deleted, concurrent edits, a revoked credential with a pending write, a restart with pending writes, rate limits and duplicate jobs. Required tests: none yet (say so).
- **`testing.md`** (owner #494): its purpose (the test strategy: tiers, fixtures, how workers and security rules are tested). Open: tiers, fixtures such as a fake GitHub client and a controllable clock, worker tests on the #479 infrastructure including the restart case, coverage per area, how the security rules are verified. Required tests: none yet (say so).

## Files to Change
- `docs/agents/specs/issues/edge-cases.md` — new.
- `docs/agents/specs/issues/testing.md` — new.
