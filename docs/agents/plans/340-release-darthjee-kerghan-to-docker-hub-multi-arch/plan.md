# Plan: Release darthjee/kerghan to Docker Hub (multi-arch)

Issue: [340-release-darthjee-kerghan-to-docker-hub-multi-arch.md](../../issues/340-release-darthjee-kerghan-to-docker-hub-multi-arch.md)

## Overview
Add a tag-only CircleCI job, `release-kerghan`, that builds `dockerfiles/production_kerghan/Dockerfile`
for amd64 and arm64 in one `docker buildx` run and pushes a multi-arch manifest as
`darthjee/kerghan:<CIRCLE_TAG>` and `:latest`. The Dockerfile gains one base stage per architecture,
pinned to the `production_kerghan-base` version from the `version` file.

See [infra.md](infra.md) for the full plan.
