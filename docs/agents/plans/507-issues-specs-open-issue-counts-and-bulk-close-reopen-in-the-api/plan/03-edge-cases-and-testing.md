# Edge cases and testing

Index the new cases and extend the test plan.

- **`edge-cases.md`:** add a group "Counts and bulk" (after "Users and cleanup", before "Indexed rows of other files") with rows E66 to E74 exactly as in the issue's Edge cases table, in the matrix's six-column shape (`#` | Case | Expected behavior | Rule | Check | Status), status `Contract`, the Rule column linking to `api/issues.md` (bulk), `api/projects.md` (E73) or `security.md` (E74). Update "Row ids are stable (`E1…E65`)" to `E1…E74`, add the group to the "Groups, in order" line, and list E66 to E74 in Required tests (E66 to E69 as `(db)`).
- **`testing.md`:** in Security verification, the route access matrix lists 19 routes, adding `issues/bulk-state` under `/projects/:projectId/`; in Races, add the bulk races (E66 to E69) as `(db)`; in Frontend tests, mention the open-issue count on project rows and the bulk bar, selection and summary notice (tested in #563); keep the "Coverage per area" table consistent.

## Files to Change

- `docs/agents/specs/issues/edge-cases.md` — new group E66 to E74, id range, groups line, Required tests.
- `docs/agents/specs/issues/testing.md` — route matrix (19), races, frontend tests.
