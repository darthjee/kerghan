# Verify coverage and report

Check the acceptance criteria of #492 against GitHub, not only against the drafts:

1. **Coverage.** Every file under `docs/agents/specs/issues/` (including the `api/` and `ui/` pages) and `docs/agents/specs/issues.md` is named in the "Builds against" section of at least one new issue. Check it with a loop over `find docs/agents/specs/issues* -name '*.md'` and `gh issue view <id> --json body` for the 12 ids, and fix any gap with `gh issue edit`.
2. **Order and dependencies.** `gh api repos/<owner>/<repo>/issues/483/sub_issues` lists the 12 new issues. Each one's body has a "Depends on" section that matches the split table. Its `dependencies/blocked_by` list matches the edges of step 03, except the refused edges recorded there.
3. **Last issue.** The fold issue (row 12) has the highest number of the set and is blocked by rows 7, 10, 11 and #507.
4. **No code.** `git diff origin/main --stat` shows only `docs/agents/issues/492-…`, `docs/agents/plans/492-…` and `docs/agents/specs/issues*` files.

Then post a comment on #492 that lists the 12 issues in order with their numbers and dependencies, and lists any blocked-by edges the API refused. In the PR description, put the same list, so the reviewer can check it without opening each issue.

## Files to Change

- None beyond step 04. Writes one GitHub comment on #492.
