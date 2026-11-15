# Plan: Add background workers to the backend (deku-swarm)

Issue: [479-add-navi-worker-deku-swarm.md](../../issues/479-add-navi-worker-deku-swarm.md)

## Overview

Add an always-on `Workers` module to the backend that runs a `deku-swarm` worker pool inside the API process, with optional `KERGHAN_WORKERS_*` env config, a `WorkersService` (`register` / `enqueue`) for other modules, a bounded drain on shutdown, and a logged (not restarted) engine crash. Infrastructure only: no job, no endpoint.

See [backend.md](backend.md) for the full plan.
