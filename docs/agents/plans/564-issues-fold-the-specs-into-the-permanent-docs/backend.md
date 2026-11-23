# Backend Plan: Issues: fold the specs into the permanent docs

Main plan: [plan.md](plan.md)

## Shared contracts

- Repoint with the mapping table in [plan.md](plan.md#shared-contracts). Anchors are unchanged, so only the path part changes.
- The edge-case page is `docs/agents/modules/issues/edge-cases.md`, with rows still `| E<n> |`.
- Report the audit to the architect as a list: each backend Required test, the spec file and tier that cover it, and any test added.

## Steps

- [01 — Repoint the spec references](backend/01-repoint-references.md)
- [02 — Point the edge-case coverage spec at the new page](backend/02-coverage-spec-path.md)
- [03 — Audit the backend Required tests and fill gaps](backend/03-required-tests-audit.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_db_tests` (CI job: `backend_db_tests`), only if step 03 adds or changes a DB-backed test

## Notes

- Steps 01 and 02 change comments and one path constant only, with no behavior change.
- Never run `yarn` or `node` on the host; always use docker-compose.
