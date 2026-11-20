# Manual verification

There's no agent test harness and no CI job for these files, so verify by hand and put the results in the PR description.

1. **Sample questions**: dispatch the refreshed `product-owner` agent with each question from the issue's "Testing strategy" table (1–8, plus 9 only after confirming no doc covers a per-user dashboard theme preference). Paste its answers next to the expected verdicts. Any mismatch means steps 01/02 need fixing before the PR is opened.
2. **Map links resolve**: `ls` every path in the agent's map, from the repo root, and paste the output.
3. **Shared wording**: run a case-sensitive `grep -n` for "undecided — needs product decision" and "no documented rule" over `.claude/agents/data-access.md`, `.claude/agents/product-owner.md` and `.claude/agents/architect.md`, and paste the output. Every file must use the identical lowercase spelling.

Use only `ls`/`grep` on the host. No language runtime or package manager.

## Files to Change

- None (verification only; results go in the PR description).
