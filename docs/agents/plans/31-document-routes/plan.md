# Plan: Document routes

Issue: [31-document-routes.md](../issues/31-document-routes.md)

## Overview

Add a dedicated, per-endpoint route reference under `docs/agents/backend/routes/`, starting with
the Auth domain (the only backend module that exists today), indexed by
`docs/agents/backend/routes.md`. Cross-link it from the existing `docs/agents/modules/auth.md`
"## Routes" summary table (kept as-is) instead of replacing that table, and reference the new
doc from `docs/agents/summary.md` and `docs/agents/index.md`.

## Context

`docs/agents/modules/auth.md` already documents Auth's routes as a compact summary table
(entity/event-focused page). This issue's GitHub body came with a fully drafted, more detailed
per-endpoint reference for the same four `AuthController` routes — this plan turns that content
into the first domain page of a new `docs/agents/backend/routes/` tree, per the
discuss-issue dialogue on #31 (duplication accepted, cross-linked rather than merged; new
`docs/agents/backend/` subfolder used as literally requested in the issue rather than reusing
`docs/agents/modules/` or `docs/agents/architecture/`).

This is a pure documentation change — every file touched lives under `docs/agents/`, which is
entirely the architect's own scope (see `.claude/agents/architect.md`). No specialist agent
(`backend`, `frontend`, `infra`, `proxy`, `cache`, etc.) has work here.

## Steps

- [01 — Add the Auth routes page](plan/01-add-auth-routes-page.md)
- [02 — Add the routes index](plan/02-add-routes-index.md)
- [03 — Cross-link modules/auth.md](plan/03-cross-link-modules-auth.md)
- [04 — Update summary.md and index.md](plan/04-update-summary-and-index.md)

## Notes

- No CI job covers `docs/` (see `.circleci/config.yml`) — no `## CI Checks` section needed.
- Only the Auth domain is populated for now; future backend modules add their own
  `docs/agents/backend/routes/<domain>.md` file as they land (see Expected Behavior in the issue).
- `docs/agents/modules/auth.md`'s own "## Routes" table is intentionally left untouched beyond
  the added cross-link — the two pages are expected to be kept in sync manually going forward.
