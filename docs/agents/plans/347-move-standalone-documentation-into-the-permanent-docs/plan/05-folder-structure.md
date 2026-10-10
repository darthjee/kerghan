# Update folder-structure.md

- "Project Root" table: add `standalone/` (Vault-based standalone distribution: inner compose
  stack, Tent standalone configuration, `kerghan` client, installer, `config.example`, smoke
  test). Update the `bin/` row to list `release_kerghan.sh`, `release_kerghan_standalone.sh` and
  `release_kerghan_assets.sh`.
- New "## `standalone/` — Standalone Distribution" table: `vault/` (`docker-compose.yml`,
  `tent/` with `configuration/` and the git-ignored `static/`), `bin/kerghan`, `install.sh`,
  `config.example`, `scripts/smoke_test.sh`, `test/`, and the git-ignored `images/<arch>/`
  tarballs. Check `ls -R standalone` for the actual contents. Link to `standalone.md`.
- "`dockerfiles/`" section: mention `dockerfiles/kerghan_standalone/` (targets `standalone` and
  `standalone-offline`, `Dockerfile.dockerignore`).
- "`.claude/agents/`" table: add `standalone.md`.
- "`docs/agents/`" table: add `standalone.md` to the top-level reference docs list.

## Files to Change

- `docs/agents/folder-structure.md` — standalone folders, scripts, agent and doc
