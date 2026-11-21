# Plan: Issues: foundation (module, tables, config, cleanup)

Issue: [553-issues-foundation-module-tables-config-cleanup.md](../../issues/553-issues-foundation-module-tables-config-cleanup.md)

## Overview

Builds the backend foundation of the Issues and Projects epic (#483), with no route: the `issues` module, its four tables and entities, the nine config keys (read through a new shared positive-integer helper), the `user.deleted` cleanup listener, the single access check, the DB seed builders with the intruder user, and the static specs of the module skeleton. Only the schema-level Required tests are owned here (see the issue's *Test scope*). The whole change sits in `backend/` (plus `docs/agents/environment-variables.md`), so the `backend` agent owns it; `security` and `data-access` review it.

See [backend.md](backend.md) for the full plan.
