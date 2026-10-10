# Issue: Rename image tags: dev_kerghan and kerghan

## Description

Part of epic #336. Free up the `darthjee/kerghan` name for the production image, which will be
released to Docker Hub in #340. This is only a rename, kept separate so it is easy to review.
The target naming is specified in `docs/agents/specs/standalone/images.md`.

## Problem

Today:

- `darthjee/kerghan` is the **local dev** image tag (`docker-compose.yml` `base` anchor, built
  from `dockerfiles/kerghan/Dockerfile`, "local tag only — not pushed"). `make build` also tags
  that same dev image as `kerghan`, `darthjee/kerghan` and `darthjee/kerghan:$(BASE_VERSION)`.
- `darthjee/production_kerghan` is the local tag of the production image (`base_prod` anchor,
  built from `dockerfiles/production_kerghan/Dockerfile`, which Render currently builds).

Releasing the production image as `darthjee/kerghan` while the dev image still uses that name
would make the two collide.

## Expected Behavior

- Dev image: `darthjee/kerghan` becomes `darthjee/dev_kerghan` (still local only), following
  the `production_` / `vite_` / `circleci_` prefix convention.
- Production image: `darthjee/production_kerghan` becomes `darthjee/kerghan` (still local only
  until #340 publishes it).
- The `dockerfiles/` folders are **not** renamed: `dockerfiles/production_kerghan/` builds
  `darthjee/kerghan`, and `dockerfiles/kerghan/` builds `darthjee/dev_kerghan`. Render keeps
  building from `dockerfiles/production_kerghan/Dockerfile`, unaffected.
- The `*-base` images (`kerghan-base`, `production_kerghan-base`, `circleci_kerghan-base`,
  `vite_kerghan-base`) keep their names.

## Solution

Update every reference to the two leaf image tags:

- `docker-compose.yml`: `base` anchor image becomes `darthjee/dev_kerghan`, `base_prod` anchor
  image becomes `darthjee/kerghan`.
- `Makefile`: `make build` builds the dev image from `dockerfiles/kerghan/Dockerfile`; it must tag
  it **only** `darthjee/dev_kerghan` (drop the bare `kerghan` and the push-style
  `darthjee/kerghan[:$(BASE_VERSION)]` tags, since nothing pushes the dev image), and must never
  tag anything `darthjee/kerghan`. Update the "leaf images are not published" comment to the new
  names.
- Docs naming the leaf images, with or without the `darthjee/` prefix: `AGENTS.md` (backend image
  family line), `.claude/agents/infra.md` (service table and leaf image section),
  `docs/agents/folder-structure.md` (leaf images list), `docs/agents/architecture/infra.md`, and
  any other hit of `grep -rnw "kerghan\|production_kerghan\|darthjee/kerghan"` that refers to an
  image (not to the repo, project, service or `*-base` images).
- Stale local image: document a one-time cleanup, in the PR description and in the infra docs
  (`.claude/agents/infra.md` / `docs/agents/architecture/infra.md`): developers who still have the
  old dev image tagged `darthjee/kerghan` must run `docker image rm darthjee/kerghan` and rebuild
  with `docker-compose build base_prod_build` (or `docker-compose run base_prod_build`), otherwise
  `base_prod` would run the stale dev image under the production tag.
- Leave untouched: historical issue and plan files, and `docs/agents/specs/standalone/`, which
  already describes the target names and the rename itself.

## Acceptance criteria

- `docker-compose run` / `make` targets for dev (`make dev`, `make tests`, `make setup`) and the
  production sanity check (`base_prod_build` / `base_prod`) still work with the new tags (run
  through docker-compose, never on the host).
- `make build` tags only `darthjee/dev_kerghan`.
- The stale-image cleanup is documented.
- No stale reference to the old leaf tags remains, apart from historical issue/plan files and
  the standalone specs.

## Depends on

#337 (standalone specs).

**Owner:** infra
