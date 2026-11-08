# Plan: Specs: repositories — Integrations GitHub client

Issue: [448-specs-repositories-integrations-github-client.md](../../issues/448-specs-repositories-integrations-github-client.md)

## Overview

Fold the Integrations-side decisions of #448 into `docs/agents/specs/repos/`: the exported
`IntegrationsGithubService` (fixed `GET`-only operations, typed results), a single GitHub client
for authenticated and unauthenticated calls, the endpoints and parameters per source, the
in-memory GitHub App installation-token cache, the "usable integration" rule, the error-mapping
table and Add's candidate walk, the `502`/`503` helpers moving to `core/`, the awaited
`integration.deleted` event with a sync safety net, and the unauthenticated budget tracker's home
and two thresholds. Specs only: no code, no permanent docs.

## Context

- Epic #444; fourth spec-enhancement sub-issue, after #445 (dbb4af3), #446 (0cbc561) and #447
  (8df5722).
- #448 owns every "Open — settled by #448" marker in `docs/agents/specs/repos/` (README "Open
  markers" table: `model.md#logical-foreign-keys`, `sync.md#sources`,
  `integrations.md#exported-service`, `integrations.md#access-link-on-add`,
  `integrations.md#deletion-hook`, `security.md#credentials-stay-in-the-backend`, plus the inline
  notes in `sync.md#handle-credential`, `sync.md#rate-limits` and `api.md#add`).
- The issue file's Solution section is the source of truth for every operation, endpoint, value
  and rule; copy it, do not re-decide.
- Existing code the specs refer to: `backend/src/integrations/github-client.service.ts` (`send`:
  `redirect: 'error'`, 10 s timeout, 64 KiB cap), `github-app-client.service.ts`,
  `integration-http-errors.ts` (`githubUnavailable`, `githubRateLimited`),
  `core/error-codes.ts`, and the `@nestjs/event-emitter` usage in `auth/` (fire-and-forget
  `emit`; this one is an awaited `emitAsync`).
- Per-type pages for the 401 reasons and the GitHub App test mapping:
  `docs/agents/modules/integrations/{pat,oauth-app,github-app}.md`.
- No specialist owner: docs under `docs/agents/` are the architect's scope (as for #445–#447).

## Steps

- [01 — integrations.md: service, client, endpoints, tokens, usable, errors, hook, tracker](plan/01-integrations.md)
- [02 — sync.md and model.md knock-ons](plan/02-sync-and-model.md)
- [03 — api.md and security.md knock-ons](plan/03-api-and-security.md)
- [04 — README: markers, decisions summary, sub-issues row, #452 checklist](plan/04-readme.md)
- [05 — Consistency check and agent review](plan/05-consistency-and-review.md)

## CI Checks

- Docs only; no backend/frontend job is affected. Check that relative links and anchors between
  the spec files resolve.

## Notes

- Keep the spec voice of the existing files: short bullets, links to sibling files, "Required
  tests" at the end of each file.
- Replace each "Open — settled by #448" note with the decision; never leave the note beside it.
- Stay out of #449 (handle validation, column), #450 (edge-case matrix, user-deletion cleanup, a
  dedicated status for a vanished handle, rows of long-unusable integrations) and #451 (mocking
  tools, test layout): point at them instead.
- Two existing statements are replaced, not appended to: `security.md`'s "the unauthenticated one
  (Repositories)" and the claim that Add honours the sync's low-budget threshold.
- `github-app.md`'s "minted per use" is not edited here: it goes onto #452's checklist.
