# Update infra and standalone docs

Record the store-independent per-arch pull, and that this suite now tests the release script.

- `docs/agents/architecture/infra/releases.md`, `release-kerghan-standalone` section: describe how the offline tarballs are produced. Each inner image is pulled by its `linux/<arch>` manifest digest from the registry (index or single-platform manifest), re-tagged to `repo:tag`, checked with `docker image inspect` and saved. Explain why: the containerd image store keeps multi-platform images under one tag, so a pull by tag plus `--platform` followed by an inspect reports the host architecture. Mention that the job logs the Docker version and storage driver. Add a one-line note that #580's diagnosis (amd64 base images) was not the cause of this symptom (#589).
- `docs/agents/standalone/inner-stack.md`: in the offline-image paragraph, add that the per-arch tarballs are single-architecture (pulled by digest) where it says they are written by `bin/release_kerghan_standalone.sh` with `docker save`.
- `docs/agents/architecture/infra/ci-jobs.md`: the `scripts_tests` row also covers `bin/release_kerghan_standalone.sh` (`save_image`).
- `docs/agents/folder-structure.md`: the `scripts/` row says `scripts/test/` also covers `bin/release_kerghan_standalone.sh`.

## Files to Change

- `docs/agents/architecture/infra/releases.md`: the digest-pull explanation and the #589 note.
- `docs/agents/standalone/inner-stack.md`: tarballs are single-arch.
- `docs/agents/architecture/infra/ci-jobs.md`: `scripts_tests` scope.
- `docs/agents/folder-structure.md`: `scripts/test/` scope.
