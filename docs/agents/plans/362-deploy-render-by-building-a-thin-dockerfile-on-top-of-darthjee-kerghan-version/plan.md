# Plan: Deploy Render by building a thin Dockerfile on top of darthjee/kerghan:<version>

Issue: [362-deploy-render-by-building-a-thin-dockerfile-on-top-of-darthjee-kerghan-version.md](../../issues/362-deploy-render-by-building-a-thin-dockerfile-on-top-of-darthjee-kerghan-version.md)

## Overview
Rename the Docker Hub production Dockerfile to `dockerfiles/release_kerghan/`, put a one-line
`FROM darthjee/kerghan:<version>` Dockerfile at the path the Git-backed Render service already
builds (`dockerfiles/production_kerghan/Dockerfile`), keep its version bumped by
`scripts/bump_version.sh`, and revert `scripts/deploy.sh`/`scripts/render.sh` to the
branch-update + plain deploy flow, guarded by a FROM-tag == CIRCLE_TAG check.

See [infra.md](infra.md) for the full plan.
