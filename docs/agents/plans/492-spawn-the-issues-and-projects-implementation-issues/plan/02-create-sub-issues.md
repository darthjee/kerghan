# Create the sub-issues under #483

Create the 12 issues in row order, so the issue numbers follow the dependency order and every "Depends on" placeholder points at an issue that already exists:

1. Before the first call, list the open sub-issues of #483 (`gh api repos/<owner>/<repo>/issues/483/sub_issues`) and read the mapping file (`<scratchpad>/492/mapping.txt`) if it exists. Skip any row that already has an issue, so a re-run never duplicates one.
2. For each row, replace the "row N (<title>)" placeholders in its body with the `#<id>` values already in the mapping. Then run:

   ```bash
   <arcanum>/_lib/spawn_issue.sh "$REPO_PATH" 483 "<title>" <body_file> --as-subissue
   ```

   Parse `STATUS=` and `ID=`. Append `N=<id>` to the mapping file right away. On `STATUS=failed`, stop and report the rows already created. Do not retry blindly.
3. Every placeholder points backwards (a row depends only on earlier rows), so no body needs to be edited after creation. If a body is edited anyway, use `gh issue edit <id> --body-file <file>`.

## Files to Change

- None in the repo. Writes 12 GitHub issues and `<scratchpad>/492/mapping.txt`.
