# Add the new rows to edge-cases.md

- Add a group "Link creation, unlinking and repository change" (after "GitHub issue and link") with E57 to E64 exactly as in the issue (rows: not found, `410` or `301` on creation; rate limited; no usable integration, `401` or `403`; timeout, network error or `5xx`; attach where local values differ; repository change with links and the race; unlink with unsent changes; attach to an already linked issue or unlink an unlinked one), each with Expected behavior, Rule (link to [github-link.md](github-link.md) sections), Check and Status `Contract`.
- Update the "How to read" bullets: ids are `E1…E64`; the group list gains the new group.
- Update E1 and E2 (the states: `gone` with reason `deleted` or `moved`; remove "the name is #487's" and "(#487)" owners, the Rule column points at `github-link.md`), E3 (refused on attach and import, skipped on refresh), E22 and E27 only where they mention #487.
- Open questions: remove "State names, and what GitHub actually answers for a deleted or transferred issue" (#487).
- Required tests: add E57 to E64 to the tier lists (unit for E57 to E61; e2e for E62 to E64 answers, with E62's race in the DB-backed tier `(db)`; E63 and E64 e2e), and to the "new tests defined by the Check column" and "tested where the owning file lists them" bullets; keep every row listed once.
- The "Indexed rows of other files" ids stay unchanged (E41 to E56).

## Files to Change
- `docs/agents/specs/issues/edge-cases.md` — the new group and rows, the updated rows, the open questions and the tier lists.
