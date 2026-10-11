# Rename the release Dockerfile and add the thin Render Dockerfile

Move the Docker Hub production image's build files to `dockerfiles/release_kerghan/` (content
unchanged apart from paths), then create a new `dockerfiles/production_kerghan/Dockerfile` that
Render builds.

- `git mv dockerfiles/production_kerghan/Dockerfile dockerfiles/release_kerghan/Dockerfile` and
  `git mv dockerfiles/production_kerghan/entrypoint.sh dockerfiles/release_kerghan/entrypoint.sh`
  (keep the executable bit).
- In the moved Dockerfile, change `COPY ./dockerfiles/production_kerghan/entrypoint.sh` to
  `./dockerfiles/release_kerghan/entrypoint.sh`. Nothing else changes (stages, `BASE_VERSION`,
  `TARGETARCH` handling, `ENTRYPOINT`).
- Create `dockerfiles/production_kerghan/Dockerfile` containing only a short comment (what it is:
  the Dockerfile Render builds, pinned by `scripts/bump_version.sh`, guarded by
  `scripts/deploy.sh`) and the single line `FROM darthjee/kerghan:0.6.0` — the current release
  version, matching README/package.json; the next `bump_version.sh 0.6.1` moves it to 0.6.1. No
  other instruction: `ENTRYPOINT` and everything else are inherited.
- Point `bin/release_kerghan.sh` (`-f dockerfiles/release_kerghan/Dockerfile`) and
  `docker-compose.yml` `base_prod_build` (`dockerfile: dockerfiles/release_kerghan/Dockerfile`) at
  the renamed file. Update the header comment of `bin/release_kerghan.sh` if it names the path.

## Files to Change
- `dockerfiles/production_kerghan/Dockerfile` → `dockerfiles/release_kerghan/Dockerfile` — moved; entrypoint `COPY` path updated
- `dockerfiles/production_kerghan/entrypoint.sh` → `dockerfiles/release_kerghan/entrypoint.sh` — moved, unchanged
- `dockerfiles/production_kerghan/Dockerfile` — new thin `FROM darthjee/kerghan:0.6.0`
- `bin/release_kerghan.sh` — build from `dockerfiles/release_kerghan/Dockerfile`
- `docker-compose.yml` — `base_prod_build` builds `dockerfiles/release_kerghan/Dockerfile`
