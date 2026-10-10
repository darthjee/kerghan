# Infra Plan: Rename image tags: dev_kerghan and kerghan

Main plan: [plan.md](plan.md)

## Overview

Rename the leaf image tags in `docker-compose.yml` and the `Makefile`, update every doc that names
those leaf images, and document a one-time cleanup of the stale local `darthjee/kerghan` dev image.

## Context

- Target naming is specified in `docs/agents/specs/standalone/images.md` (epic #336).
- `docker-compose.yml`: `base` anchor (`image: darthjee/kerghan`, built by `base_build` from
  `dockerfiles/kerghan/Dockerfile`) and `base_prod` anchor (`image: darthjee/production_kerghan`,
  built by `base_prod_build` from `dockerfiles/production_kerghan/Dockerfile`).
- `Makefile`: `make build` runs
  `docker build -f $(DOCKER_FILE) . -t $(IMAGE) -t $(PUSH_IMAGE) -t $(PUSH_IMAGE):$(BASE_VERSION)`
  with `DOCKER_FILE=dockerfiles/$(PROJECT)/Dockerfile`, `IMAGE=$(PROJECT)`,
  `PUSH_IMAGE=$(DOCKER_ID_USER)/$(PROJECT)`, i.e. it tags the **dev** image `kerghan`,
  `darthjee/kerghan` and `darthjee/kerghan:0.1.0`. After the rename that would collide with the
  production tag.
- Render builds from `dockerfiles/production_kerghan/Dockerfile` (Dockerfile path, not tag), so it
  is unaffected.

## Steps

- [01 — Rename the tags in docker-compose and the Makefile](infra/01-rename-compose-and-makefile.md)
- [02 — Update the docs naming the leaf images](infra/02-update-docs.md)
- [03 — Document the stale-image cleanup and verify](infra/03-stale-image-cleanup-and-verify.md)

## CI Checks

- No CI job builds the leaf images; CI runs from the published `*-base` images, so no CI job is
  directly affected. Verify locally through docker-compose (step 03).

## Notes

- Leave untouched: historical issue/plan files and `docs/agents/specs/standalone/` (they already
  describe the target names and the rename itself).
- Do not rename the `*-base` images (`kerghan-base`, `production_kerghan-base`,
  `circleci_kerghan-base`, `vite_kerghan-base`), the `dockerfiles/` folders, the compose service
  names (`kerghan_app`, `kerghan_tests`, ...), `PROJECT`, the Render service name or any repo URL.
- The "leaf images are not published" statements stay true after this issue (`darthjee/kerghan` is
  only published from #340 on); only the names in them change.
- Never run `docker`/`make`/tooling assumptions on the host beyond docker-compose, per CLAUDE.md.
