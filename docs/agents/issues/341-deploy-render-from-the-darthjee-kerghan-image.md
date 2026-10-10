# Deploy Render from the darthjee/kerghan image

**Owner:** infra

## Context

Part of epic #336. Render currently rebuilds `dockerfiles/production_kerghan/Dockerfile` from
source on every deploy. On a semver tag, CircleCI's `build-and-release` job runs
`scripts/deploy.sh update_deploy_branch` (pointing the Render service `kerghan` at the git
tag), triggers a deploy, and polls `watch_deployment` until it is `live`.

Now that the `darthjee/kerghan:<tag>` image is released (sub-issue 4 of #336), Render should
run that exact released image instead of building its own. Render never runs the standalone
(Vault) image.

## What needs to be done

### Infra (`scripts/`, `.circleci/config.yml`)

- `scripts/deploy.sh` / `scripts/render.sh`: stop changing the deploy branch. Trigger a deploy
  of the exact image with `POST /services/{id}/deploys` and body
  `{"imageUrl": "docker.io/darthjee/kerghan:<CIRCLE_TAG>"}`, then keep polling with
  `watch_deployment`.
- Remove `update_deploy_branch` / `update_service_branch`.
- Always deploy the version tag, never `latest`. A rollback is a deploy of the previous tag;
  document how to run it with the script.
- `.circleci/config.yml`: `build-and-release` requires `release-kerghan` instead of
  `release-production_kerghan-base` / `release-production_kerghan-base-arm64`.

### Docs (`docs/agents/`)

- Rewrite the "Why `build-and-release` requires the production-base release-image jobs"
  rationale in `docs/agents/architecture/infra.md`.
- Add the manual Render checklist below (infra architecture page or a Render runbook). The
  user does all Render-side changes by hand; this issue only documents them:
  - Switch the existing service's source in place: Settings → Build → Source → Existing
    Image, `docker.io/darthjee/kerghan:<tag>` (public, no registry credential). Verified in
    #337: Render allows switching a Git-backed service to a prebuilt image
    (https://render.com/changelog/change-your-services-backing-repo-or-image-in-the-render-dashboard).
  - The service id and the `kerghan.onrender.com` hostname stay the same: no new service, no
    copying of environment variables, no change to the Tent `$backendHost`.
  - Image-backed services have no auto-deploy. CI triggers every deploy with `imageUrl`
    (or a person does, manually, for a rollback).
  - The production database is external to the service, so no data moves.

## Depends on

Sub-issue 4 of #336 (release `darthjee/kerghan`).

## Acceptance criteria

- [ ] A tag deploy triggers Render with `imageUrl` set to that tag and waits for `live`.
- [ ] `update_deploy_branch` / `update_service_branch` are removed; `latest` is never deployed.
- [ ] Rollback (deploying the previous tag via the script) is documented.
- [ ] `build-and-release` requires `release-kerghan` instead of the production-base release jobs.
- [ ] The `infra.md` rationale is rewritten and the manual Render checklist is in the docs.
