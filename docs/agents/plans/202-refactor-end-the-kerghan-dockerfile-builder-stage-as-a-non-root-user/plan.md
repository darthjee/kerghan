# Plan: Refactor: End the kerghan Dockerfile builder stage as a non-root user

Issue: [202-refactor-end-the-kerghan-dockerfile-builder-stage-as-a-non-root-user.md](../../issues/202-refactor-end-the-kerghan-dockerfile-builder-stage-as-a-non-root-user.md)

## Overview

Add `USER node` at the end of the `builder` stage in `dockerfiles/kerghan/Dockerfile` so it no longer ends as `root`, clearing a Hadolint DL3002 finding with no change to the shipped final image.

See [infra.md](infra.md) for the full plan.
