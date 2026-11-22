# Backend Plan: Issues: security verification

## Overview

This is the last backend piece of epic #483. It adds the cross-cutting security specs of `docs/agents/specs/issues/testing.md#security-verification` that #553 to #558 did not deliver, and walks the `security.md#review-checklist` items over the whole Issues module.

## Context

- **Already done; reuse it and do not redo it:**
  - static specs: `module-boundaries`, `eslint-boundary`, `no-sql-now`, `column-allowlist`, the `*.no-github` specs, `integrations-writer-boundary` and `integrations-github-get-only`;
  - cache-policy coverage, which already lists the three controllers;
  - writer field rejection, `301` handling, token permission sets, quotas and the project-deletion transaction;
  - the unit-level `{ linkId }` checks.
- **The gaps** (from the gap analysis on `a469394`):
  - The access matrix is split per controller and has no global completeness check or admin column.
  - There are no credential or content canary sweeps. The harnesses use `FakeIntegrationsGithubService`, and the HTTP-DB harness does not mount request logging.
  - The DB harnesses seed one user.
  - No spec checks that a unique-index `409` logs nothing.
  - The edge-case rows E5, E9, E23, E27, E28, E30, E38, E43 and E49 have no covering spec, and E6, E31, E33, E40, E48, E55 and E61 are covered but not cited.
- **Decisions taken while refining the issue:**
  - The new matrix **replaces** the three per-controller access specs.
  - **Every** DB harness seeds the intruder by default.
  - The missing edge-case tests are written **here**.
- **Out of scope:**
  - The frontend static spec and rendering units belong to #560 to #562.
  - Bulk-state belongs to #563: its matrix row, the bulk weight, and E66 to E74.
  - E25 belongs to the future "remove repository" feature.
- There are 18 routes today. The completeness check forces #563 to add the `bulk-state` row.

## Steps

- [01 — Two-user baseline in every DB harness](backend/01-two-user-baseline.md)
- [02 — Cross-controller route access matrix](backend/02-route-access-matrix.md)
- [03 — Canary harness with real Integrations services and request logging](backend/03-canary-harness.md)
- [04 — Credential canary sweep and job-params allowlist](backend/04-credential-canary-sweep.md)
- [05 — Content canary sweep and unique-index logging](backend/05-content-canary-sweep.md)
- [06 — Edge-case coverage](backend/06-edge-case-coverage.md)
- [07 — Review checklist walk and docs](backend/07-review-checklist.md)

## CI Checks

- `backend`: `docker-compose run kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run kerghan_tests yarn test:db` against the MySQL service (CI job: `backend_db_tests`)

## Notes

- Never run `yarn`, `node` or `npm` on the host; always use `docker-compose`.
- The canary harness must keep GitHub credentials inside the Integrations module. It wires the real services and mocks only `fetch`, and it adds no new path that reads a credential from Issues.
- If a sweep finds a real leak, fix it in production code in this PR, and update the spec too if that changes a decision.
- Reviews: `security` and `data-access` (the checklist walk), and `cache` (the matrix's `X-Skip-Cache` and `no-store` column).
