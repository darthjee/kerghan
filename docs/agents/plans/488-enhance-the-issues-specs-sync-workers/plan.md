# Plan: Enhance the Issues specs: sync workers

Issue: [488-enhance-the-issues-specs-sync-workers.md](../../issues/488-enhance-the-issues-specs-sync-workers.md)

## Overview

Documentation only. Rewrite `docs/agents/specs/issues/sync.md` from the decisions recorded in the issue's **Solution** section (fields, the reconcile algorithm, triggers, job design, rate limits, retry values and `sync_failed` transitions, staleness, integration selection, marker lifecycle, GitHub issue client operations), close every open question owned by #488, and apply the issue's "Spec housekeeping" list to the related spec files so they stay consistent. No code, migrations or endpoints.

## Context

- The issue file is the single source of the decisions; this plan says where each one lands. Specs describe decisions, not code; every touched file keeps its "Required tests" section in sync with its rules.
- The workers infrastructure of #479 exists (`backend/src/workers/workers.service.ts`, `docs/agents/modules/workers.md`): `register`/`enqueue`, engine-wide `maxRetries` 3 and cooldown 5 s, per-class getter overrides, dead-lettering with no hook. `sync.md` must stop saying it depends on or waits for #479.
- #501 (merged) already revised `github-link.md` (addressing by owner/name, the issues probe as `gone` guard, E65 redirects, `updated_at`-bound attach confirmation, `sync_failed` exit rules). The decisions of #488 build on that text; do not reintroduce the id-path addressing or a repository-read guard.
- E24 changed during refinement: `denied` is final (`docs/agents/modules/auth/user-approval.md`) and `authorization-request.approved` is login authorization, so there is **no** approval trigger; markers of a non-approved user stay until the user is deleted.
- The edge-case matrix is an index, not a second source of truth: outcomes are written in the owning file first (`sync.md`), then the row is updated.

## Steps

- [01 — Rewrite sync.md](plan/01-rewrite-sync-md.md)
- [02 — Update model.md and github-link.md](plan/02-model-and-github-link.md)
- [03 — Update edge-cases.md, testing.md and the issues.md index](plan/03-edge-cases-and-testing.md)
- [04 — Update api.md, ui.md, security.md and projects.md](plan/04-api-ui-security-projects.md)
- [05 — Consistency sweep](plan/05-consistency-sweep.md)

## Notes

- **Deviation from the issue's housekeeping list:** `docs/agents/environment-variables.md` and `docs/agents/modules/workers.md` describe what the code does today ("Keeping this doc honest" in `environment-variables.md`). The three `KERGHAN_ISSUES_SYNC_*` keys and the `issues.reconcile` job are therefore written into `sync.md` only (with their defaults and validation), and `sync.md` states that the implementation issue adds them to those two docs as consumed values in the same change that reads them. Neither file is edited here.
- No CI job covers `docs/`; verification is reading the touched files for broken anchors and contradictions (step 05).
- Risk: `sync.md` grows large. Keep it one file with clear `##` sections mirroring the issue's `###` subsections; split only if a section exceeds what reads comfortably, and if so link it from `sync.md` and `issues.md`.
