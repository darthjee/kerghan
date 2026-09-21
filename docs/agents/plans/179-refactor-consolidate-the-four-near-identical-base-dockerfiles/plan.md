# Plan: Refactor: consolidate the four near-identical *-base Dockerfiles

Issue: [179-refactor-consolidate-the-four-near-identical-base-dockerfiles.md](../../issues/179-refactor-consolidate-the-four-near-identical-base-dockerfiles.md)

## Overview
Replace `dockerfiles/{kerghan,circleci_kerghan,production_kerghan,vite_kerghan}-base/Dockerfile` with one shared, build-arg-driven `dockerfiles/base/Dockerfile`, built through `bin/image.sh` with a per-image `--build-arg` set and `--target`.

See [infra.md](infra.md) for the full plan.
