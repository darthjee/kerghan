# Set the blocked-by relationships

For each row, add one GitHub "blocked by" relationship per dependency of the "waits for" column, plus #507 for rows 11 and 12. Row 6's dependency on #479 is not added, because #479 is closed.

The dependencies API takes the blocking issue's internal `id` (not its number):

```bash
BLOCKER_ID=$(gh api repos/<owner>/<repo>/issues/<blocker_number> --jq .id)
gh api -X POST repos/<owner>/<repo>/issues/<blocked_number>/dependencies/blocked_by -F issue_id="$BLOCKER_ID"
```

- Edges from the split table: 3←1; 4←3; 5←2,4; 6←2,5; 7←6; 8←3; 9←4,8; 10←5,6,9; 11←#507,4,9; 12←1 to 11 and #507.
- For row 12, add only its direct blockers (rows 7, 10 and 11, plus #507). Rows 1 to 6, 8 and 9 already reach it through those rows. Its body still says "all of the above".
- Before adding an edge, read the existing ones (`GET .../dependencies/blocked_by`) and skip an edge that is already there, so a re-run is safe.
- If the API refuses a call, keep going, record the edge, and list the missing edges in the PR description. The bodies already carry the dependencies.

## Files to Change

- None in the repo. Writes GitHub issue dependencies.
