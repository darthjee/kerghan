# Architect Plan: Issues: fold the specs into the permanent docs

Main plan: [plan.md](plan.md)

## Shared contracts

- Write the target pages exactly at the paths of the mapping table in [plan.md](plan.md#shared-contracts), keeping each source file's headings verbatim so anchors survive.
- `modules/issues/edge-cases.md` keeps the `| E<n> |` row format and every id.
- Each page keeps its `## Required tests` section. `modules/issues/required-tests.md` indexes them, built from the audit lists that backend and frontend report.

## Steps

- [01 — Write the module docs](architect/01-module-docs.md)
- [02 — Write the route docs](architect/02-route-docs.md)
- [03 — Rewrite the fold-list statements and environment variables](architect/03-fold-list-and-env.md)
- [04 — Repoint permanent docs and agent files](architect/04-repoint-docs-and-agents.md)
- [05 — Apply the approved root-file edits](architect/05-root-files.md)
- [06 — Required-tests index](architect/06-required-tests-index.md)
- [07 — Delete the specs and complete the entry](architect/07-delete-specs.md)

## CI Checks

The docs have no CI job of their own. Before the PR, run the final sweep from step 07, and run every check of the backend and frontend files, because the deletion is what breaks a stale reference:

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`), `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `frontend`: `docker-compose run kerghan_fe yarn coverage` (CI job: `jasmine`), `docker-compose run kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- Fold, don't rewrite. Copy each decision as it stands. Where a spec cross-links another spec file, repoint the link with the mapping table and recompute the relative path from the new location (`modules/issues/` versus `backend/routes/issues/`).
- Drop what only made sense while the spec was active: `specs/issues.md`'s *Lifecycle* and *Implementation issues* sections, and the "fold at #564" wording. The history lives in the *Completed specs* row and in the epic.
- Keep each unresolved *Open questions* or *Not decided* item (the repository-removal mechanism, and labels as a follow-up) in the page where it was, under the same heading. Drop the items already ticked, and keep the decision they point at.
- If folding shows a spec and the code disagree, raise it. Do not bend the permanent doc to match the code.
