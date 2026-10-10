# Rename the tags in docker-compose and the Makefile

Switch the two leaf image tags to their new names.

- `docker-compose.yml`:
  - `base` anchor: `image: darthjee/kerghan` → `image: darthjee/dev_kerghan` (keep the
    "local tag only — not pushed to Docker Hub" comment).
  - `base_prod` anchor: `image: darthjee/production_kerghan` → `image: darthjee/kerghan`.
  - Leave `base_build` / `base_prod_build` `dockerfile:` paths unchanged.
- `Makefile`:
  - `make build` must tag the dev image **only** `darthjee/dev_kerghan`: replace
    `-t $(IMAGE) -t $(PUSH_IMAGE) -t $(PUSH_IMAGE):$(BASE_VERSION)` with a single tag built from a
    dev-image variable (e.g. `IMAGE?=$(DOCKER_ID_USER)/dev_$(PROJECT)`, falling back to `darthjee`
    if `DOCKER_ID_USER` is unset is not needed — match how `FE_IMAGE` is defined). Drop
    `PUSH_IMAGE` if nothing else uses it. `DOCKER_FILE` stays `dockerfiles/$(PROJECT)/Dockerfile`.
  - It must never tag anything `darthjee/kerghan`.
  - Update the comment above `build:` ("the leaf kerghan (backend app) and production_kerghan
    images are not published") to name `dev_kerghan` and `kerghan`.

## Files to Change
- `docker-compose.yml` — `base` and `base_prod` image tags.
- `Makefile` — `make build` tags, related variables, leaf-image comment.
