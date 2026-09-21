# Matrix the release-image jobs
Replace the eight `release-image` workflow entries with a single `matrix` entry, keeping every resulting job name byte-identical:

- Change the `release-image` job's parameters from `arch` to `suffix` (string, default `""`, values `""` or `"-arm64"`). The release step derives the arch in shell — e.g. `bin/image.sh push << parameters.image >> "$(echo '<< parameters.suffix >>' | sed 's/^-//')"` or `S='<< parameters.suffix >>'; bin/image.sh push << parameters.image >> "${S#-}"` — so `bin/image.sh` keeps receiving an empty arg for amd64 and `arm64` for arm64. The QEMU step is unchanged.
- In the `test` workflow, one entry: `release-image` with `name: release-<< matrix.image >><< matrix.suffix >>`, `matrix: parameters: { image: [kerghan-base, circleci_kerghan-base, production_kerghan-base, vite_kerghan-base], suffix: ["", "-arm64"] }` and `filters: *all_tags`.
- Confirm the eight generated names are exactly `release-kerghan-base`, `release-kerghan-base-arm64`, `release-circleci_kerghan-base`, `release-circleci_kerghan-base-arm64`, `release-production_kerghan-base`, `release-production_kerghan-base-arm64`, `release-vite_kerghan-base`, `release-vite_kerghan-base-arm64`, and that every `requires:` reference in the workflow still resolves (`config validate`/`config process` will fail on an unresolved dependency).
- Update the comment above the job (multi-arch publish of 4 base images) to mention the matrix.

## Files to Change
- `.circleci/config.yml` — `release-image` job parameter change (`arch` → `suffix`) and the eight workflow entries → one matrix entry.
