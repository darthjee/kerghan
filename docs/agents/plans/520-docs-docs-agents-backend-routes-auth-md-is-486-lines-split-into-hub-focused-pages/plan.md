# Plan: Docs: docs/agents/backend/routes/auth.md is 486 lines — split into hub + focused pages

Issue: [520-docs-docs-agents-backend-routes-auth-md-is-486-lines-split-into-hub-focused-pages.md](../../issues/520-docs-docs-agents-backend-routes-auth-md-is-486-lines-split-into-hub-focused-pages.md)

## Overview
Pure documentation reorganization owned by the architect: turn `docs/agents/backend/routes/auth.md` into a hub and move its sections into focused pages under `docs/agents/backend/routes/auth/`.

## Context
The file is 486 lines, above the 300-line cap. Same pattern as the earlier hub splits (#515, #516, #517, #518).

## Implementation Steps
1. Read `auth.md` and split it into `auth/login.md`, `auth/authorization-requests.md`, `auth/sessions-and-account.md` and `auth/shared.md` (boundaries may be adjusted), moving content verbatim. Reduce `auth.md` to a hub (summary, intro, endpoint index, Source files, page index with one-line descriptions).
2. Fix relative links inside moved content, and update every inbound link (AGENTS.md, `.claude/agents/*.md`, other docs under `docs/agents/`) to the new pages and anchors.
3. Verify every page is under 300 lines and no content was dropped.

## CI Checks
- No code changes; docs only.

## Notes
- No specialist agent has work; the architect owns `docs/agents/`.
