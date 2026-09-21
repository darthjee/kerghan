# Remove the four per-image Dockerfiles
Once Steps 01–02 are in place, delete the now-redundant per-image directories so there is a single source of truth (leaving them would recreate the drift this issue removes). Only the four `*-base` directories go — the leaf `kerghan`, `vite_kerghan` and `production_kerghan` directories (and `production_kerghan/entrypoint.sh`) stay as they are.

Then grep the repo (excluding `node_modules` and `docs/agents/issues|plans`) for any remaining reference to `dockerfiles/<image>-base` or `dockerfiles/$image` (Makefile, scripts, docs, agent files, CI config) and fix or note it. The Makefile's `DOCKER_FILE`/`DOCKER_FILE_FE` variables point at the **leaf** Dockerfiles, so they stay untouched.

## Files to Change
- `dockerfiles/kerghan-base/Dockerfile` — delete.
- `dockerfiles/vite_kerghan-base/Dockerfile` — delete.
- `dockerfiles/production_kerghan-base/Dockerfile` — delete.
- `dockerfiles/circleci_kerghan-base/Dockerfile` — delete.
