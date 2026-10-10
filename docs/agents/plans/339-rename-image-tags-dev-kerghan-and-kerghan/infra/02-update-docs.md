# Update the docs naming the leaf images

Replace every mention of the leaf images by their new names. Only image references change — not
the repo, project, compose service names or `*-base` images.

- `AGENTS.md` line ~100: backend image family list `(`kerghan`, ...)` → `dev_kerghan` for the dev
  image (and mention `kerghan` as the production image if the sentence lists it).
- `.claude/agents/infra.md`:
  - Services table: `kerghan_app` / `kerghan_tests` image `darthjee/kerghan` →
    `darthjee/dev_kerghan`.
  - "leaf app images" paragraph: `darthjee/kerghan` (backend) → `darthjee/dev_kerghan` (dev
    backend), `darthjee/production_kerghan` → `darthjee/kerghan` (production).
- `docs/agents/folder-structure.md` line ~96: leaf images `(`kerghan`, `production_kerghan`,
  `vite_kerghan`)` → name the images they build (`dev_kerghan` from `dockerfiles/kerghan/`,
  `kerghan` from `dockerfiles/production_kerghan/`, `vite_kerghan`), making clear folder names
  are unchanged.
- `docs/agents/architecture/infra.md` line ~135: "`production_kerghan` is `FROM` this" → the
  `darthjee/kerghan` production image (built from `dockerfiles/production_kerghan/`).
- Final sweep: `grep -rnI 'darthjee/kerghan\b\|production_kerghan\b\|`kerghan`' .` excluding
  `node_modules`, `docs/agents/issues`, `docs/agents/plans`, `docs/agents/specs/standalone`;
  fix any remaining leaf-image reference (ignore `-base`, `-standalone`, repo URLs, service names).

## Files to Change
- `AGENTS.md` — backend image family names.
- `.claude/agents/infra.md` — services table and leaf image paragraph.
- `docs/agents/folder-structure.md` — leaf images list.
- `docs/agents/architecture/infra.md` — production leaf image name.
