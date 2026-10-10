# Document the new job

Update the infra docs to describe the new job and the Dockerfile change:

- `docs/agents/architecture/infra.md`:
  - Job graph: add `release-kerghan`, fed by the five test/lint jobs and
    `release-production_kerghan-base(-arm64)`, and note that nothing requires it yet (#341 / #343
    will).
  - Jobs table: add a `release-kerghan` row (machine, tag only, multi-arch buildx push of
    `darthjee/kerghan:<tag>` and `:latest` via `bin/release_kerghan.sh`).
  - Mention that this image is a multi-arch manifest, unlike the `-arm64` suffix convention of the
    base images, and that it is versioned by the git tag, not the `version` file.
  - Update the `production_kerghan-base` row and the "Why `build-and-release` requires the
    production-base release-image jobs" section: the production Dockerfile now picks its base per
    `TARGETARCH`, and is pinned to the `version` file only in `release-kerghan` (`latest` elsewhere).
- `.claude/agents/infra.md`: in the leaf image section, say that `darthjee/kerghan` is now published
  (multi-arch) by `release-kerghan` / `bin/release_kerghan.sh`. `darthjee/dev_kerghan` is still never
  pushed.

Do not touch `docs/agents/specs/standalone/` (it already describes the target) or historical
issue/plan files.

## Files to Change
- `docs/agents/architecture/infra.md` — job graph, jobs table, multi-arch/versioning note, production Dockerfile base selection.
- `.claude/agents/infra.md` — leaf image section: `darthjee/kerghan` is now published.
