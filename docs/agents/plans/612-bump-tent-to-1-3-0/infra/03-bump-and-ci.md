# Bump to 1.3.0, CI check step, infra docs

Apply the bump with the new script, wire the drift check into CI, and rewrite the infra prose.

- Run `scripts/bump_tent.sh 1.3.0` on the host (a plain repository script, like `bump_vault.sh`; no package manager involved). Expected result: `docker-compose.yml` (`kerghan_proxy` → `darthjee/tent:1.3.0`; `proxy_tests`, `proxy_lint` → `darthjee/tent-test:1.3.0`), `.circleci/config.yml` (`proxy_extension_tests` → `tent-test:1.3.0`; `upload_proxy_files`, `copy_proxy_configuration`, `upload_extension` → `tent:1.3.0`), `docs/agents/architecture/infra/ci-jobs.md` (4 rows), `.claude/agents/proxy.md` and `.claude/agents/infra.md` (stale `0.10.x` pins) all at 1.3.0. Then run `scripts/bump_tent.sh --check` and confirm exit 0.
- `.circleci/config.yml`, `scripts_tests` job: add a step after `Tests`, `name: Tent pins in sync`, `command: scripts/bump_tent.sh --check`. No new job; the job is already required by `build-and-release`.
- `docs/agents/architecture/infra/releases.md`: rewrite the standalone release description from "`darthjee/tent:1.0.3` for amd64, `darthjee/tent:1.0.3-arm64` for arm64" to one multi-arch Tent tag read from `version`, saved once per architecture by digest, guarded by `require_platform_manifest`. Avoid a literal Tent version; if one remains, add the file to `bump_tent.sh`'s list.
- Document `bump_tent.sh` where `bump_vault.sh` / `bump_version.sh` are documented (search `docs/agents/` for `bump_vault`), including the `--check` CI step and the rule that `security.md` is updated by hand after each recheck.

## Files to Change

- `docker-compose.yml`, `.circleci/config.yml`, `docs/agents/architecture/infra/ci-jobs.md`, `.claude/agents/proxy.md`, `.claude/agents/infra.md` — rewritten by `bump_tent.sh 1.3.0`.
- `.circleci/config.yml` — `bump_tent.sh --check` step in `scripts_tests`.
- `docs/agents/architecture/infra/releases.md` — multi-arch Tent prose.
- The doc that lists the bump scripts — add `bump_tent.sh`.
