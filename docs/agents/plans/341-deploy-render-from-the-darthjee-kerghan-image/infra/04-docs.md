# Document the Render image deploy (architect)

Architect-owned (`docs/agents/`).

- `docs/agents/architecture/infra.md`:
  - Rewrite "Why `build-and-release` requires the production-base release-image jobs" as "Why
    `build-and-release` requires `release-kerghan`": Render now pulls `darthjee/kerghan:<tag>` by
    `imageUrl`, so that tag must be published first; `release-kerghan` already requires the
    production-base jobs, so `release` still gets the ordering transitively.
  - Update the CI graph, the CI jobs table, the scripts table (`deploy`, `deploy_image`, no
    `update_deploy_branch`), the "Render builds the same Dockerfile by path" line and the
    "#341 will ..." forward references; add the `scripts_tests` job.
  - Add a "Render deploy and rollback" subsection: CI flow, rollback command
    (`RENDER_API_KEY=... scripts/deploy.sh deploy_image <previous-tag>`), and the manual Render
    checklist from the issue (switch to Existing Image `docker.io/darthjee/kerghan:<tag>` before the
    first image deploy; same service id/hostname, no env-var copy, no Tent `$backendHost` change; no
    auto-deploy; external database).
- `docs/agents/environment-variables.md`: keep `RENDER_API_KEY` / `RENDER_SERVICE_NAME` accurate.

## Files to Change

- `docs/agents/architecture/infra.md` — rationale, diagram, tables, Render deploy/rollback section
- `docs/agents/environment-variables.md` — Render variable notes, if affected
