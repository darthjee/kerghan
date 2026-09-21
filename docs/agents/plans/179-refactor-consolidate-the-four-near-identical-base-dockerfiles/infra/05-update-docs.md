# Update documentation
Update the docs that describe the per-image base Dockerfiles so they describe the shared Dockerfile and the `bin/image.sh` arg map instead.

- `docs/agents/folder-structure.md` — the `dockerfiles/` section says "One directory per service image … each with a `-base` variant". Update it to say the four `*-base` images are built from the shared `dockerfiles/base/Dockerfile` (one named target per image, per-image build args in `bin/image.sh`), while the leaf images (`kerghan`, `production_kerghan`, `vite_kerghan`) keep their own directories. Also update the table row at the top of the file (`dockerfiles/` — "One directory per built image, `-base`/leaf pairs") to match.
- `docs/agents/architecture/infra.md` — in the `release-image` section, add a short note that all `*-base` images build from `dockerfiles/base/Dockerfile` via `bin/image.sh`, that `skip_if_unchanged` now diffs `dockerfiles/base/` and `bin/image.sh`, and where the version pins (`darthjee/scripts`, `darthjee/node`) live (`ARG` defaults in the shared Dockerfile) so future bumps are one-line edits.
- `.claude/agents/infra.md` — the "Backend image publishing" section mentions `bin/image.sh`'s `skip_if_unchanged` guard; adjust it if needed so it stays accurate (no scope change is required).
- `README.md` line 62 (`dockerfiles/  # Dockerfiles for each service`) stays accurate; leave it unless the wording turns out misleading.

Keep the existing (separate) inconsistency between docs about whether the backend base images are published to Docker Hub out of this change — it is unrelated to this refactor.

## Files to Change
- `docs/agents/folder-structure.md` — `dockerfiles/` section and table row.
- `docs/agents/architecture/infra.md` — note on the shared Dockerfile, arg map, guard and pin location.
- `.claude/agents/infra.md` — keep the `skip_if_unchanged`/image-building description accurate.
