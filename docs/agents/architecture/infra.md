# Architecture — Infra

CircleCI (`.circleci/config.yml`) is Kerghan's only CI/CD pipeline: it runs tests/lint on every
push and, on semver tag pushes only, builds/publishes images and triggers the production
release. This page documents that pipeline's job graph — the "infra" counterpart to
`architecture/proxy.md`/`frontend.md`/`backend.md`. Modeled on Majora's
`.claude/agents/infra.md` "CircleCI pipeline" section, adapted to Kerghan's simpler
Render-based deploy (no `link_photos`/`link_files`/`upload_admin_assets`/`wake-navi`
equivalents — Kerghan doesn't warm the Navi cache from CI yet, see `docs/agents/cache-warmer.md`).

## Pipeline summary

- **Every push** — test and lint jobs (`backend_tests`, `backend_db_tests`, `backend_checks`,
  `jasmine`, `frontend-checks`, `proxy_extension_tests`, `standalone_tests`, `scripts_tests`).
- **Semver tag pushes only** (`\d+\.\d+\.\d+`) — the release chain: `build-and-release`,
  `release-kerghan` (production image + Render deploy), `release-kerghan-standalone`,
  `release-kerghan-assets` and `release`, all gated by the shared `tags_only` filter.
- **Base-image publishes** — the `release-image` jobs run on every push but are no-ops unless
  the push is a tag and the base Dockerfiles changed.

## Pages

- [infra/workflow.md](infra/workflow.md) — read when changing the workflow graph, job ordering,
  filters, `.codacy.yml` false positives, or why `build-and-release` requires `release-kerghan`.
- [infra/ci-jobs.md](infra/ci-jobs.md) — read for the job table, `backend_db_tests`, the MySQL
  version, `release-image` instances, leaf image tags and the stale-image cleanup.
- [infra/releases.md](infra/releases.md) — read for `release-kerghan`, the Render deploy,
  `release-kerghan-standalone`, `release-kerghan-assets`, production Dockerfile base selection
  and the shared base Dockerfile.
- [infra/ci-setup.md](infra/ci-setup.md) — read for the backend/frontend CI setup pattern,
  validating the CircleCI config locally, scripts, the Tent pin (`bump_tent.sh`), migrations on
  production boot, and the missing Navi warm-up job.
