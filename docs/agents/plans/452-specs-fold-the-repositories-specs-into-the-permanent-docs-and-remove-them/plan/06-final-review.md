# Final review and PR description

- Re-read the new Repositories docs end to end for spec-only wording ("will", "Open", "settled by #", "spec") and for duplication: each rule has one owner doc and links elsewhere, following the #451 owner table.
- Ask the `cache` agent to review (read-only) that the folded docs match the `@CachePolicy` classes, and the `security` / `data-access` agents to confirm the security section and access rules match the code. Fold any finding in, or open an issue.
- If a source comment was touched, run the backend and frontend lint through docker-compose.
- PR description:
  - the four staged commits;
  - the **moot checklist items** with reasons;
  - the **mismatch list** from step 01, each with the doc decision and the issue opened, if any;
  - a note that verification is manual.

## Files to Change

- None beyond fixes found during review.
