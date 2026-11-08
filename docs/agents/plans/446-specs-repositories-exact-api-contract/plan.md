# Plan: Specs: repositories — exact API contract

Issue: [446-specs-repositories-exact-api-contract.md](../../issues/446-specs-repositories-exact-api-contract.md)

## Overview

Rewrite `docs/agents/specs/repos/api.md` into the exact API contract settled in #446 (four `POST`
routes, request/response shapes, repo ref, pagination, sync state and polling, Refresh and Add
contracts, error table, Add rate-limit values, contract tests), and apply the knock-on decisions
to `security.md`, `ui.md`, `sync.md`, `integrations.md` and the folder README. Specs only: no
code, no permanent docs.

## Context

- Epic #444; second spec-enhancement sub-issue after #445 (merged in dbb4af3), which created the
  folder with `> **Open — settled by #NNN:** …` markers and a README open-markers table.
- #446 owns the markers `api.md#listing`, `api.md#contract`, `security.md#errors-and-logging`
  and the #446 half of `ui.md#sync-ux`.
- The issue file's Solution section is the source of truth for every value; copy it, do not
  re-decide.
- Repo convention (`docs/agents/backend/routes/integrations.md`): user-scoped reads use `POST`;
  `api.md` currently says `GET` for the listing and sync state.
- No specialist owner: docs under `docs/agents/` are the architect's scope (same as #445).

## Steps

- [01 — Rewrite api.md as the exact contract](plan/01-api-contract.md)
- [02 — security.md: errors and Add verification](plan/02-security.md)
- [03 — ui.md: sync UX, banners, Add errors](plan/03-ui.md)
- [04 — sync.md and integrations.md knock-ons](plan/04-sync-and-integrations.md)
- [05 — README: open markers and decisions summary](plan/05-readme.md)
- [06 — Consistency check and agent review](plan/06-consistency-and-review.md)

## CI Checks

- Docs only; no backend/frontend job is affected. Check Markdown links resolve (relative links
  between the spec files, anchors such as `api.md#add`, `security.md#errors-and-logging`).

## Notes

- Keep the spec voice of #445's files: short bullets, links to sibling files, "Required tests"
  at the end of each file.
- Do not create `docs/agents/backend/routes/repositories.md` nor touch `architecture/*.md`:
  #452 folds them.
- The admin-endpoint handle shape stays with #449; stale-remote renames stay with #450; the
  polling interval and cooldown/TTL values stay with #447.
