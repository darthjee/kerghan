# UI specs

Replace the "API in #507" placeholders with links to the decided API, and align the UI wording with the response shape.

- **`ui.md`:** line 5, drop "marked 'API in #507'" and point the count and bulk at [api/projects.md](api/projects.md) and [api/issues.md](api/issues.md); Open questions, remove the #507 dependency ("None left in this file."); Required tests, rename the "API in #507" bullet to "Counts and bulk" and add the summary notice from `changed`/`unchanged`/`notFound`, the re-read after the call, and the "Try again in N s" countdown on the bulk bar for `ISSUE_EDIT_RATE_LIMITED`.
- **`ui/states.md`:** Scope, "Brought into v1, with the API part in #507" → "Brought into v1" with links to the API; the count reads `openIssueCount` from every project object (rows only, may lag); the bulk notice: "Closed N issues" from `changed.length`, "M were already closed" from `unchanged.length`, "K were no longer found" when `notFound` is non-empty, then one re-read; replace "The exact outcome reporting and rate-limit behaviour follow #507" with the `429` rule (nothing applied; the bar's buttons show the countdown, selection kept). Error map: the `ISSUE_EDIT_RATE_LIMITED` row also applies to the bulk bar. Line 48, keep #563 as the implementation.
- **`ui/screens-and-flows.md` (line ~19):** "projects carry no counts in v1" → the project list shows only the open-issue count; the project page still has no separate overview.

## Files to Change

- `docs/agents/specs/issues/ui.md` — intro, Open questions, Required tests.
- `docs/agents/specs/issues/ui/states.md` — Scope bullets, error map row.
- `docs/agents/specs/issues/ui/screens-and-flows.md` — the "no counts" sentence.
