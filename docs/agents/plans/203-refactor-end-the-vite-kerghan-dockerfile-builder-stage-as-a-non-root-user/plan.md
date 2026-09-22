# Plan: Refactor: End the vite_kerghan Dockerfile builder stage as a non-root user

Issue: [203-refactor-end-the-vite-kerghan-dockerfile-builder-stage-as-a-non-root-user.md](../issues/203-refactor-end-the-vite-kerghan-dockerfile-builder-stage-as-a-non-root-user.md)

## Overview
Add a `USER node` line to the end of the `builder` stage in `dockerfiles/vite_kerghan/Dockerfile` so it no longer ends as root, clearing Hadolint DL3002 — mirroring the identical fix already applied to `dockerfiles/kerghan/Dockerfile` in issue #202 (commit b224675).

See [infra.md](infra.md) for the full plan.
