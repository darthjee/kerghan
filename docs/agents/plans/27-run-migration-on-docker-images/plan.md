# Plan: Run migration on Docker images

Issue: [27-run-migration-on-docker-images.md](../issues/27-run-migration-on-docker-images.md)

## Overview
Make the production Docker image run `yarn migration:run` before starting the
server, failing fast on migration errors, via an `entrypoint.sh` wired in as
`ENTRYPOINT` on `dockerfiles/production_kerghan/Dockerfile`.

See [infra.md](infra.md) for the full plan.
