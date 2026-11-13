# Plan: Repositories: backend module, tables and sync engine

Issue: [463-repositories-backend-module-tables-and-sync-engine.md](../../issues/463-repositories-backend-module-tables-and-sync-engine.md)

## Overview

A new, always-on `backend/src/repositories/` module (Epic #444, slice D). It contains:
- the five Repositories tables and their migrations;
- the in-process, detached sync engine (claim, lease, pages, ETags, pruning, link fill);
- the `integration.deleted` and `user.deleted` listeners;
- the typed service API that #464's routes will call.

It also needs a small Auth export change (an optional `EntityManager`, plus `UserDeletedEvent`) and one Integrations `(db)` spec. No HTTP routes are added. Backend only.

See [backend.md](backend.md) for the full plan.
