# Backend Plan: Add background workers to the backend (deku-swarm)

Main plan: [plan.md](plan.md)

## Overview

All code changes are inside `backend/`; the docs (`docs/agents/`) ship in the same PR (last step). Nothing changes in compose, standalone, CircleCI, Render, the proxy or Navi: no endpoint is added, so no cache or data-access review is needed.

## Context

Decisions from the issue: in-process pool (no separate service); always-on module exporting `WorkersService`; registries built with `ensureBuild` in `onModuleInit`, engine (`keepAlive: true`) started in `onApplicationBootstrap`; on `onApplicationShutdown` the engine is stopped and busy workers get a fixed ~10 s bounded drain (polling `WorkersRegistry.hasBusyWorker()`); an engine crash is logged with the error class only, never restarted; four optional env vars with fall-back-to-default semantics; in-memory queues (persistence, scheduling and pruning are deferred in `docs/agents/future.md`).

## Steps

- [01 — Add the deku-swarm dependency](backend/01-add-dependency.md)
- [02 — Workers config](backend/02-workers-config.md)
- [03 — Workers module, service and lifecycle](backend/03-workers-module-and-service.md)
- [04 — Specs and the reset helper](backend/04-specs.md)
- [05 — Documentation](backend/05-documentation.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_app yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_app yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_app yarn build` (type-checks the new module and `deku-swarm` typings)

## Notes

- Never run `yarn`/`npm` on the host; add the dependency through `docker-compose` (see step 01). Check the Node image version the package works with and that it resolves as ESM under `"module": "NodeNext"`.
- `deku-swarm` may ship no TypeScript types. If so, add a minimal declaration under `backend/src/types/` (next to `express.d.ts`) covering only what the module uses, rather than `any` everywhere.
- No `Clock` use for the drain: `Clock` only has `now()`. The drain timeout and poll interval are constructor/config values specs override.
- `app.enableShutdownHooks()` is **not** called in `main.ts` today; without it the drain never runs on SIGTERM.
- Review focus for the first job's issue (not this one): the security review of the endpoint that enqueues it.
