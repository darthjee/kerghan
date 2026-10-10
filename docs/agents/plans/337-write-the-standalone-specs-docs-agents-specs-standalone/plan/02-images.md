# Write images.md

Create `docs/agents/specs/standalone/images.md`:

- Table of images: `darthjee/kerghan` (`<app-semver>`, `latest`; built from
  `dockerfiles/production_kerghan/Dockerfile`), `darthjee/kerghan-standalone` (`<v>`, `latest`;
  target `standalone`), `darthjee/kerghan-standalone` (`<v>-offline`, `latest-offline`; target
  `standalone-offline`), `darthjee/dev_kerghan` (local only, from `dockerfiles/kerghan/Dockerfile`).
- Renames: dev `darthjee/kerghan` → `darthjee/dev_kerghan`; `darthjee/production_kerghan` →
  `darthjee/kerghan`; `dockerfiles/` folders are not renamed; every reference updated (#339).
- Versioning: the app git semver tag, not the `version` file (which stays for `*-base` images);
  `kerghan-standalone:<v>` bakes `kerghan:<v>`.
- Pinned inner/base images: `darthjee/vault:0.1.0` (multi-arch), `mysql:9.3.0` (multi-arch),
  `darthjee/tent:1.0.3` / `1.0.3-arm64` (separate tags, see `stack.md`).
- Multi-arch manifests (amd64 + arm64) for both public images, departing from the base images'
  `-arm64` suffix convention.
- When: every semver tag push, after tests; no "skip if unchanged" guard.
- CI order: `release-production_kerghan-base(-arm64)` → `release-kerghan` → {`release-kerghan-standalone`,
  `build-and-release` (Render)} → release-assets job (`installer.md`).
- **Required tests:** on a tag, each tag above exists and `docker manifest inspect` shows amd64 and
  arm64; `kerghan-standalone:<v>`'s compose references `kerghan:<v>`; dev and production compose
  services still build with the renamed tags.

## Files to Change
- `docs/agents/specs/standalone/images.md` — new.
