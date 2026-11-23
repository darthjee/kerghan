# Write the route docs

Create `docs/agents/backend/routes/issues.md` (hub) from `specs/issues/api.md`, with its *Every route*, *Exposed identifiers*, *Open questions* and *Required tests* sections and its page index. Move the four `api/*.md` files to `docs/agents/backend/routes/issues/` (`projects.md`, `issues.md`, `github-link.md`, `errors-and-validation.md`), with the headings kept verbatim. Follow the shape of `backend/routes/repositories.md`. Link the hub to the module hub `../../modules/issues.md`, and recompute every relative link.

If `docs/agents/backend/` has an index of route docs (for example a routes list in `docs/agents/backend/` or `docs/agents/architecture/backend/`), add the Issues and Projects entry next to Repositories.

## Files to Change

- `docs/agents/backend/routes/issues.md`: new hub.
- `docs/agents/backend/routes/issues/projects.md`, `issues.md`, `github-link.md`, `errors-and-validation.md`: new pages.
- Any route index that lists `repositories.md`: add `issues.md`.
