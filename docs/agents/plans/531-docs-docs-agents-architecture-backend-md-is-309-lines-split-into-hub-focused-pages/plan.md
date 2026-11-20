# Plan: Docs: docs/agents/architecture/backend.md is 309 lines — split into hub + focused pages

Issue: [531-docs-docs-agents-architecture-backend-md-is-309-lines-split-into-hub-focused-pages.md](../../issues/531-docs-docs-agents-architecture-backend-md-is-309-lines-split-into-hub-focused-pages.md)

## Overview
Pure documentation reorganization, owned by the architect (no specialist agent has work).
Turn `docs/agents/architecture/backend.md` (309 lines) into a hub and move its later sections
into three pages under `docs/agents/architecture/backend/`, the same pattern already used for
`architecture/infra.md` + `architecture/infra/`.

## Context
The file is above the 300-line cap from AGENTS.md. Current sections: Stack, Layout, Owned
tables, Build (lines 1-104, stay in the hub); Routing convention, Data source, Origin Guard
(CSRF), Health probes, JWT Guard, Admin Guard (105-171); Error responses and Dependency
injection only (172-253); Testing with DB-backed tier and Injected time source (254-309).

## Implementation Steps

### Step 1 — Create the pages and slim the hub
Create `docs/agents/architecture/backend/request-pipeline.md` (Routing convention through
Admin Guard), `error-responses.md` (Error responses + Dependency injection only) and
`testing.md` (Testing, DB-backed tier, Injected time source), moving the text verbatim, each
with an `# Architecture — Backend: <topic>` title and a one-line back-link to the hub. Heading
text is kept so existing anchors (`#error-responses`, `#testing`) keep the same slug on the new
page. Fix relative links inside the moved content for the extra directory level (for example
`./modular-pattern.md` becomes `../modular-pattern.md`; `docs/agents/...` paths are
repo-rooted and stay). Remove the moved sections from `backend.md` and end it with a `## Pages`
index (one "read when" line per page), as `architecture/infra.md` does. Every file stays
under 300 lines.

### Step 2 — Update inbound links
Re-point every link that targets a moved section to the new page and anchor:
- `#error-responses` links: `docs/agents/backend/routes/integrations.md`,
  `docs/agents/backend/routes/repositories/errors-and-access.md` (two),
  `docs/agents/specs/issues/api/errors-and-validation.md`,
  `docs/agents/specs/issues/api/projects.md`,
  `docs/agents/architecture/frontend.md` (prose reference).
- `#testing` link: `docs/agents/modules/repositories/testing.md`; prose reference in
  `docs/agents/modules/auth.md`.
- Routing convention references: `docs/agents/architecture/modular-pattern.md` (two),
  `docs/agents/modules/auth/routes.md`.
- DI-only reference: `docs/agents/architecture/modular-pattern.md`.
- The `docs/agents/specs.md` row (#444) citing `architecture/backend.md` for
  `error.retryAfterSeconds`, the DB-backed test tier and the injected `Clock`.
- Links that keep targeting the hub for Stack/Layout/Owned tables/Build (AGENTS.md,
  `.claude/agents/*.md`, `architecture.md`, `contributing.md`, `folder-structure.md`,
  `environment-variables/proxy-navi-circleci.md`) are verified and left unchanged unless they
  point at a moved topic. Update `docs/agents/architecture.md`'s hub entry to mention the pages
  if useful.

## Files to Change
- `docs/agents/architecture/backend.md` — slim to hub, add `## Pages` index
- `docs/agents/architecture/backend/request-pipeline.md` — new
- `docs/agents/architecture/backend/error-responses.md` — new
- `docs/agents/architecture/backend/testing.md` — new
- The inbound-link files listed in Step 2

## Notes
- No code or CI change; verify with `wc -l` (all under 300) and a grep that no link still
  resolves to a missing anchor or path.
- The "Error responses" section may itself be near 80 lines; if it grows past the cap after
  adding the title/back-link, trim nothing — split further instead.
