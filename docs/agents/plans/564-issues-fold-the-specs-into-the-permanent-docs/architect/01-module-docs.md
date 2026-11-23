# Write the module docs

Create `docs/agents/modules/issues.md` and its pages under `docs/agents/modules/issues/`, following the mapping table in [plan.md](../plan.md#shared-contracts) and the shape of `modules/repositories.md`. Copy the content of each spec file into its target page, keep the headings verbatim, and recompute every relative link from the new location.

- **`modules/issues.md` (hub).** It takes the *Overview and purpose*, *Glossary*, *Scope* and *Product decisions* sections of `specs/issues.md`, plus the *Overview and module layout* section of `model.md`. It has a page index linking every page below and the route hub `../backend/routes/issues.md`. It also gets a *Not built* list, as Repositories has: labels, sharing and members, a per-project issue number, opt-in persistence of fetched issues, and the repository-removal mechanism. Drop the *Lifecycle* and *Implementation issues* sections.
- **Pages.** These are a one-to-one move:
  - `data-model.md` (from `model.md`, without its overview section, which went to the hub)
  - `projects.md`, `github-link.md`, `sync.md`, `security.md`, `testing.md`
  - `edge-cases.md` (`| E<n> |` rows unchanged)
- **`frontend.md`.** It takes `ui.md` (its open questions, Required tests and page index). The four `ui/*.md` files move to `modules/issues/frontend/`.
- **`model.md`'s persistence section.** In `data-model.md`, the *Persistence statement and fold list* section becomes *Persistence statement*. It keeps the statement and drops the fold table and the "at fold time (#564)" wording, now that the fold is done.

## Files to Change

- `docs/agents/modules/issues.md`: new hub.
- `docs/agents/modules/issues/data-model.md`, `projects.md`, `github-link.md`, `sync.md`, `security.md`, `edge-cases.md`, `testing.md`, `frontend.md`: new pages.
- `docs/agents/modules/issues/frontend/decisions.md`, `linking-and-sync.md`, `screens-and-flows.md`, `states.md`: new pages.
