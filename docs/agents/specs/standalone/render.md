# Render deploy by image

Read by #341. See the [README](README.md) for the feature overview and
[images.md](images.md) for the image and CI order.

## Today

On a semver tag, `build-and-release` calls `scripts/deploy.sh update_deploy_branch`, which points
the Render service at the git tag. It then triggers a deploy and polls `watch_deployment` until
the deploy is `live`. Render builds `dockerfiles/production_kerghan/Dockerfile` itself.

## Decided behavior

- `scripts/deploy.sh` no longer changes the deploy branch. It triggers a deploy of the exact
  image: `POST /services/{id}/deploys` with
  `{"imageUrl": "docker.io/darthjee/kerghan:<CIRCLE_TAG>"}`, then keeps the existing
  `watch_deployment` polling until `live`, failing the job on a failed status.
- `update_deploy_branch` and `update_service_branch` are removed.
- Deploys always use the version tag, never `latest`.
- `build-and-release` requires `release-kerghan` instead of `release-production_kerghan-base`,
  so the image exists before Render is asked to deploy it. The rationale in
  `docs/agents/architecture/infra.md` is rewritten to match (#341).
- Migrations still run from the image entrypoint (`yarn migration:run`), so nothing changes for
  the database.

## Rollback

Trigger a deploy of the previous version tag (same API call, older `<tag>`). No rebuild is
needed. A rollback across a migration is subject to the same "fix forward" rule as any release.

## Verified: in-place switch

Render allows changing an existing service's source from a Git repo to a prebuilt image
(Settings → Build → Source → Existing Image). Source:
https://render.com/changelog/change-your-services-backing-repo-or-image-in-the-render-dashboard

Consequences:

- The service id and the `kerghan.onrender.com` hostname stay the same.
- No new service, no copying of environment variables, no Tent `$backendHost` change on the PHP
  host, no change to how CircleCI looks the service up (`RENDER_SERVICE_NAME`).
- Image-backed services have no auto-deploy, which matches CI triggering every deploy with
  `imageUrl`.
- `docker.io/darthjee/kerghan` is public, so no registry credential is needed.

## Manual checklist (done by the user)

Render-side changes are manual; the epic only documents them.

1. Wait for the first `darthjee/kerghan:<tag>` to be published (#340).
2. In the Render dashboard, open the `kerghan` service: Settings → Build → Source → Existing
   Image, and set `docker.io/darthjee/kerghan:<tag>`.
3. Let CI deploy the next tag (or trigger a manual redeploy) and confirm the service goes `live`.

The production database is external to the service, so no data moves.

## Required tests

- A tag deploy calls the Render deploy API with `imageUrl` set to
  `docker.io/darthjee/kerghan:<that tag>`, then waits for `live`.
- A failed deploy status makes the job exit non-zero.
- No call changes the service's branch or source.
- `build-and-release` cannot run before `release-kerghan` succeeds.
