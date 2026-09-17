# Plan: Infra: Dockerfiles pin unversioned "latest" base image tag (3 files)

Issue: [107-infra--dockerfiles-pin-unversioned--latest--base-image-tag--3-files.md](../../issues/107-infra--dockerfiles-pin-unversioned--latest--base-image-tag--3-files.md)

## Overview
Replace the literal `:latest` tag on the base-image `FROM` line of `dockerfiles/kerghan/Dockerfile`, `dockerfiles/production_kerghan/Dockerfile`, and `dockerfiles/vite_kerghan/Dockerfile` with a `BASE_VERSION` build `ARG` defaulting to `latest`, so Hadolint's `DL3007` stops flagging these three files without changing any existing build's behavior.

See [infra.md](infra.md) for the full plan.
