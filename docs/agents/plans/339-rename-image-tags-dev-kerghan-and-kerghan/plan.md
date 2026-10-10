# Plan: Rename image tags: dev_kerghan and kerghan

Issue: [339-rename-image-tags-dev-kerghan-and-kerghan.md](../../issues/339-rename-image-tags-dev-kerghan-and-kerghan.md)

## Overview

Rename the two leaf image tags only: the local dev image `darthjee/kerghan` becomes
`darthjee/dev_kerghan`, and the production image `darthjee/production_kerghan` becomes
`darthjee/kerghan`. This frees the name for the Docker Hub release in #340. No `dockerfiles/`
folder and no `*-base` image is renamed.

See [infra.md](infra.md) for the full plan.
