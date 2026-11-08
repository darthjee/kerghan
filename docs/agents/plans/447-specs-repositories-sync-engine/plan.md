# Plan: Specs: repositories — sync engine

Issue: [447-specs-repositories-sync-engine.md](../../issues/447-specs-repositories-sync-engine.md)

## Overview

Fold the sync-engine decisions of #447 into `docs/agents/specs/repos/`: in-process execution
with a conditional-`UPDATE` lock, lease/heartbeat recovery, `run_id`-guarded writes and a hard
deadline; the concrete values; page-number pagination with a page table for ETags; per-page
transactions; the orphan pruning rule; the handle's credential choice and rate-limit skip; and
the five-table schema. Specs only: no code, no permanent docs.

## Context

- Epic #444; third spec-enhancement sub-issue, after #445 (dbb4af3) and #446 (0cbc561).
- #447 owns the markers `sync.md#execution`, `sync.md#values`, `model.md#tables`,
  `model.md#private-metadata-lifecycle` and `ui.md#sync-ux`.
- The issue file's Solution section is the source of truth for every value, column and rule;
  copy it, do not re-decide.
- Existing pattern reused: `backend/src/integrations/integration-test-cooldown.service.ts`
  (atomic claim by conditional `UPDATE`); column conventions from
  `backend/src/integrations/entities/integration.entity.ts`. MySQL, no queue infrastructure.
- No specialist owner: docs under `docs/agents/` are the architect's scope (as for #445/#446).

## Steps

- [01 — sync.md: execution, values, pagination, write path, pruning, handle](plan/01-sync.md)
- [02 — model.md: schema, last_seen_at, pruning](plan/02-model.md)
- [03 — api.md, ui.md, security.md, integrations.md knock-ons](plan/03-knock-ons.md)
- [04 — README: markers, decisions summary, #452 checklist](plan/04-readme.md)
- [05 — Consistency check and agent review](plan/05-consistency-and-review.md)

## CI Checks

- Docs only; no backend/frontend job is affected. Check that relative links and anchors between
  the spec files resolve.

## Notes

- Keep the spec voice of the existing files: short bullets, links to sibling files, "Required
  tests" at the end of each file.
- Stay out of #448 (endpoints, per-type auth, the tracker's code location, deletion-hook
  mechanism), #449 (handle column/validation), #450 (edge-case matrix, user-deletion cleanup)
  and #451 (mocking tools, test layout): point at them instead.
- `sync.md` currently says to follow every `Link` and that a `304` never costs rate limit; both
  are replaced, not appended to.
