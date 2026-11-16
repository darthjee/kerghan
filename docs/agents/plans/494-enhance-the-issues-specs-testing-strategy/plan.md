# Plan: Enhance the Issues specs: testing strategy

Issue: [494-enhance-the-issues-specs-testing-strategy.md](../../issues/494-enhance-the-issues-specs-testing-strategy.md)

## Overview

Documentation only. Write `docs/agents/specs/issues/testing.md` (tiers and default tier per category, fixtures, worker and restart tests, races, security verification, coverage per area, "Required tests"), in the shape of the Repositories testing section, and keep the other spec files consistent in the same PR.

## Context

`testing.md` is a stub with five open questions (#494). The edge-cases matrix (#493) says its fixtures are "owned by #494". The decisions are in the issue: fake by default with a few real-engine specs, DB-backed restart, an extended `FakeIntegrationsGithubService` with a required fidelity contract spec, a canary sweep over responses, job params and logs, and one coverage table. No code, migrations or endpoints are added. No specialist agent has work (the only configured agents are `architect`, the coordinator, and implementation specialists), so the architect owns every step.

## Steps

- [01 — Write testing.md](plan/01-write-testing.md)
- [02 — Align edge-cases.md](plan/02-align-edge-cases.md)
- [03 — Align the per-concern spec files](plan/03-align-spec-files.md)
- [04 — Align model.md and the index, then verify](plan/04-model-index-verify.md)

## Notes

- Model the structure on `docs/agents/modules/repositories.md#testing` (Tiers, Default tier by category, exception tags, GitHub mocking, Detached sync and time, Concurrency and races, Access control and leaks, Module-boundary tests, Frontend tests, Cache tests), adapted to issues and workers.
- The operation names of the GitHub issue client belong to #487 and #488, so `testing.md` fixes the fake's shape and contract, not method names.
- Keep `testing.md` an index of how, never a second source of truth for what: rules stay in the owning files' "Required tests".
- Open questions left in `testing.md` must name the owner issue; ideally none remain.
