# Plan: Fix release

Issue: [580-fix-release.md](../../issues/580-fix-release.md)

## Overview
The arm64 variants of the four `*-base` images are built on `darthjee/node:0.2.1` (and `darthjee/circleci_node:0.2.1`), which are amd64-only, so `darthjee/kerghan`'s arm64 image has amd64 content and the standalone release's architecture check fails. Bump the base to the multi-arch `0.3.0`, bump all four base versions and every pin, and release 0.10.1.

See [infra.md](infra.md) for the full plan.
