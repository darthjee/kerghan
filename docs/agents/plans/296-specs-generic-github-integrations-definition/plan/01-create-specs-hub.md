# Create the specs hub and link it

Create the permanent hub `docs/agents/specs.md`, which outlives the integrations specs. It must
describe:

- **Purpose** — `docs/agents/specs/<feature>/` holds a feature's temporary definition while its
  sub-issues are built; it is the source of truth implementation issues build against.
- **Lifecycle** — the first sub-issue writes the specs and adds a hub entry; the last sub-issue
  folds the lasting content into the permanent docs (`product.md`, `modules/`,
  `environment-variables.md`, …), deletes the feature folder and removes its hub entry; the hub
  itself is never deleted.
- **Conventions** — one `README.md` index per feature, files split by concern, per-variant files
  in a subfolder (like `types/`).
- **Active specs** — list with tracking issue; initially only
  `[integrations/](specs/integrations/README.md)` → #295. When empty, the list reads "none".

Then link the hub (not the feature folders) from the doc indexes:

- `docs/agents/index.md` — add a "Specs" entry (e.g. under "Conventions" or a new "Specs"
  section next to "Plans & Issues").
- `docs/agents/summary.md` — add a 2–4 line abstract of `specs.md`.
- `AGENTS.md` — add a row for `docs/agents/specs.md` to the Documentation table.

## Files to Change

- `docs/agents/specs.md` — new permanent specs hub.
- `docs/agents/index.md` — link to `specs.md`.
- `docs/agents/summary.md` — abstract for `specs.md`.
- `AGENTS.md` — Documentation table row for the specs hub.
