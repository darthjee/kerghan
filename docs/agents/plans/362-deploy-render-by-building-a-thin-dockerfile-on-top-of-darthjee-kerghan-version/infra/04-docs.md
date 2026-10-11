# Update the docs

Rewrite every place that describes the image-backed Render deploy or names the renamed path.

- `docs/agents/architecture/infra.md`: rewrite "Render deploy and rollback" as "Render deploy" —
  Render is Git-backed and builds `dockerfiles/production_kerghan/Dockerfile` (only
  `FROM darthjee/kerghan:<tag>`, pinned by `bump_version.sh`) from the release tag;
  `scripts/deploy.sh deploy` checks the FROM tag == `CIRCLE_TAG`, PATCHes the branch, POSTs a
  deploy, watches until live. Drop the rollback subsection and the manual "Existing Image"
  checklist. Fix the `build-and-release` row in the jobs table, the paragraph around line 86-90,
  the `release-kerghan` description and the mentions of `dockerfiles/production_kerghan/` as the
  Docker Hub image source (now `dockerfiles/release_kerghan/`), the entrypoint section (~line 384),
  the TARGETARCH note (~line 306), and the `scripts/deploy.sh` row in the scripts table.
- `docs/agents/standalone.md` (lines ~16 and ~345): `darthjee/kerghan` is built from
  `dockerfiles/release_kerghan/Dockerfile`.
- `docs/agents/folder-structure.md` (~line 116 and the dockerfiles listing): `release_kerghan/`
  builds `darthjee/kerghan`; `production_kerghan/` is the thin Dockerfile Render builds.
- `AGENTS.md` and `.claude/agents/infra.md`: update any `dockerfiles/production_kerghan/` reference
  meaning the Docker Hub image; mention the thin Render Dockerfile where the release flow is
  described.
- Leave historical `docs/agents/issues/` and `docs/agents/plans/` files untouched.
- Final check: `grep -rn "production_kerghan/\|imageUrl\|deploy_image\|Existing Image"` outside
  issues/plans returns only intended hits.

## Files to Change
- `docs/agents/architecture/infra.md` — Render deploy section, jobs table, release image paths
- `docs/agents/standalone.md` — release Dockerfile path
- `docs/agents/folder-structure.md` — dockerfiles folders
- `AGENTS.md` — Dockerfile path references, if any
- `.claude/agents/infra.md` — Dockerfile path references
