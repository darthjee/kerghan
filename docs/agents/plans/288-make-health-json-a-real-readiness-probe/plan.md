# Plan: Make /health.json a real readiness probe

Issue: [288-make-health-json-a-real-readiness-probe.md](../../issues/288-make-health-json-a-real-readiness-probe.md)

## Overview
Keep `GET /health.json` as a cheap liveness probe and add `GET /ready.json` as a readiness probe that checks database connectivity (`SELECT 1`) through a new hand-rolled `HealthService`, answering `503` with a per-check body when the database is down.

See [backend.md](backend.md) for the full plan.
