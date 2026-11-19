# Fix relative and in-page links in moved content
Moved content now lives one folder deeper, so relative links change:
- `](../X)` (parent docs such as `../product.md`, `../backend/routes/repositories.md#…`, `../architecture/…`) becomes `](../../X)`.
- `](repositories/sync.md#…)` and `](repositories/edge-cases.md#…)` become `](sync.md#…)` / `](edge-cases.md#…)`.
- `](integrations/…)` and `](auth/…)` become `](../integrations/…)` / `](../auth/…)`.
- `](auth.md#…)` becomes `](../auth.md#…)`.

In-page anchors (`](#section)`) that now point to a section on another page must become `](other-page.md#section)`; use the heading→page map from the plan Context. Known cross-page cases: `#module-boundaries`, `#user-deletion`, `#private-metadata-lifecycle`, `#user-scoping`, `#table`, `#source-errors`, `#empty-state`, `#github-handle`, `#route-access-matrix`, `#concurrency-and-races`, `#two-user-baseline`, `#testing`. Anchors that stay within the same page remain `#…`. The hub's own links (`integrations/…`, `repositories/sync.md#link-fill`, `auth/…`) are unchanged.

## Files to Change
- `docs/agents/modules/repositories/{data-model,security,frontend,testing,testing-coverage,required-tests}.md` — links as above.
- `docs/agents/modules/repositories.md` — only if a hub link points at a moved section.
