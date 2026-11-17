# Plan: Enhance the Issues specs: API

Issue: [489-enhance-the-issues-specs-api.md](../../issues/489-enhance-the-issues-specs-api.md)

## Overview

Documentation only. Rewrite `docs/agents/specs/issues/api.md` with every decision recorded in the issue's Solution section, so the implementation spawned by #492 can build the Issues and Projects API without deciding anything itself. Then apply the consistency edits to the other spec files in the same PR. No code, migrations, DTOs, `ErrorCodes` or permanent docs (`architecture/backend.md`, `backend/routes/`, `environment-variables.md`, Navi) change.

## Context

`api.md` holds principles only and six open questions owned by #489. Several other spec files defer refusal codes, confirmations, the issues listing sort and single-issue deletion to it. The issue's Solution section is the source for every decision. Follow the conventions of the spec set ([specs.md](../../specs.md)): specs describe decisions, not code; every file keeps its "Open questions" and "Required tests" sections up to date; rows of `edge-cases.md` keep their stable `E<n>` ids.

## Steps

- [01 — Rewrite api.md](plan/01-rewrite-api-md.md)
- [02 — Update model.md](plan/02-update-model-md.md)
- [03 — Update projects.md, github-link.md and sync.md](plan/03-update-projects-link-sync.md)
- [04 — Update edge-cases.md, testing.md, security.md, ui.md and issues.md](plan/04-update-remaining-specs.md)

## Notes

- No CI job covers `docs/`; check by hand that every relative link and anchor resolves (for example with a grep over `](` targets) and that no "(#489)" open question is left in any spec file.
- The issue file lives in `docs/agents/issues/`, so its links start with `../specs/issues/`. In `docs/agents/specs/issues/api.md` the same targets are siblings (`projects.md`) and the routes doc is `../../backend/routes/repositories.md`. Rewrite links accordingly.
- `error.meta` is decided in `api.md` only; `architecture/backend.md` is left for the implementation.
- Keep wording, screens and polling cadence out (#491), and rendering, encryption, retention, quotas and request rate limits out (#490).
