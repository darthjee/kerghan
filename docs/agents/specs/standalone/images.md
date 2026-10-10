# Images and release

Read by #339 (rename), #340 (release `darthjee/kerghan`), #343 (release the standalone image).
See the [README](README.md) for the feature overview.

## Images and tags

| Image | Built from | Tags | Published |
|---|---|---|---|
| `darthjee/kerghan` | `dockerfiles/production_kerghan/Dockerfile` | `<app-semver>`, `latest` | Docker Hub, multi-arch |
| `darthjee/kerghan-standalone` | `dockerfiles/kerghan_standalone/Dockerfile`, target `standalone` | `<app-semver>`, `latest` | Docker Hub, multi-arch |
| `darthjee/kerghan-standalone` | same file, target `standalone-offline` | `<app-semver>-offline`, `latest-offline` | Docker Hub, multi-arch |
| `darthjee/dev_kerghan` | `dockerfiles/kerghan/Dockerfile` | local only | never pushed |

## Renames (#339)

- The local dev tag `darthjee/kerghan` becomes `darthjee/dev_kerghan`, following the
  `production_` / `vite_` / `circleci_` prefix convention.
- The production tag `darthjee/production_kerghan` becomes `darthjee/kerghan`.
- Only image tags are renamed. The `dockerfiles/` folders stay as they are
  (`dockerfiles/production_kerghan/` still builds `darthjee/kerghan`).
- Every reference to the old tags is updated: `docker-compose.yml`, `Makefile`, `AGENTS.md`,
  `.claude/agents/infra.md`, `docs/agents/`.
- The rename must land before the release of `darthjee/kerghan` (#340), so that the name is never
  ambiguous between a dev and a production image.

## Versioning

- Both public images use the app's git semver tag (`\d+\.\d+\.\d+`, e.g. `0.6.0`), not the
  `version` file. The `version` file keeps tracking only the `*-base` images.
- `darthjee/kerghan-standalone:<v>` always bakes in `darthjee/kerghan:<v>` (same `<v>`), in both
  variants.
- Deploys and the client always use an exact version tag. `latest` / `latest-offline` exist for
  convenience only.

## Pinned images

| Image | Pin | Architectures |
|---|---|---|
| `darthjee/vault` (standalone base) | `0.1.0` | multi-arch manifest (every tag is one) |
| `mysql` (inner) | `9.3.0` | multi-arch manifest |
| `darthjee/tent` (inner) | `1.0.3` (amd64), `1.0.3-arm64` (arm64) | separate tags, no manifest; selected per architecture, see [stack.md](stack.md#multi-arch-tent) |

Changing a pin is a normal change to the Dockerfile or inner compose file. Publishing a multi-arch
Tent manifest upstream is an optional follow-up, outside this epic.

## Multi-arch

- Both public images are published as multi-arch manifests (amd64 and arm64 under one tag), so
  Docker picks the architecture automatically.
- This departs from the `-arm64` tag-suffix convention of the `*-base` images, which stays as it
  is for those.
- How the manifest is built (`docker buildx`, `docker manifest`, executors) is left to each
  sub-issue's plan.

## When and in which order

- Built and pushed on every semver tag push, after the tests pass. There is no "skip if
  unchanged" guard (unlike the base images).
- CI job order on a semver tag:

  1. `release-production_kerghan-base` (and its arm64 counterpart), unchanged.
  2. `release-kerghan`: pushes `darthjee/kerghan:<v>` and `:latest`. Requires step 1.
  3. In parallel, both requiring `release-kerghan`:
     - `release-kerghan-standalone`: pushes both standalone variants.
     - `build-and-release`: the Render deploy (see [render.md](render.md)).
  4. The release-assets job, requiring `release-kerghan-standalone` (see
     [installer.md](installer.md)).

- A failed `release-kerghan` blocks both the standalone release and the Render deploy.

## Required tests

- On a semver tag, every tag in the table above exists on Docker Hub, and
  `docker manifest inspect` shows amd64 and arm64 for each.
- `darthjee/kerghan-standalone:<v>` (both variants) references `darthjee/kerghan:<v>` in its inner
  compose file.
- After the rename, the dev and production compose services still build, with the new tags, and
  no reference to `darthjee/production_kerghan` or to `darthjee/kerghan` as a dev image remains.
- The CI workflow encodes the job order above (`release-kerghan` before the standalone release and
  the Render deploy).
