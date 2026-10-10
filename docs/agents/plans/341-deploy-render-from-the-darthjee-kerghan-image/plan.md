# Plan: Deploy Render from the darthjee/kerghan image

Issue: [341-deploy-render-from-the-darthjee-kerghan-image.md](../../issues/341-deploy-render-from-the-darthjee-kerghan-image.md)

## Overview

Render stops building `dockerfiles/production_kerghan/Dockerfile` from a git tag and instead deploys
the released `docker.io/darthjee/kerghan:<CIRCLE_TAG>` image via the Render deploy API (`imageUrl`).
CircleCI's `build-and-release` is gated on `release-kerghan`, and the infra architecture doc gets
the rewritten rationale, a rollback procedure and the manual Render checklist.

See [infra.md](infra.md) for the full plan.
