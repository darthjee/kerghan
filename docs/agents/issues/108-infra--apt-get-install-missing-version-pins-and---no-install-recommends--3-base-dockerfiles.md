# Issue: Infra: apt-get install missing version pins and --no-install-recommends (3 base Dockerfiles)

## Description
Codacy's Hadolint scan flags `apt-get install` in the three base Dockerfiles for two BestPractice issues, each hit at the same line in all three files:

- `dockerfiles/circleci_kerghan-base/Dockerfile:5`
- `dockerfiles/kerghan-base/Dockerfile:5`
- `dockerfiles/vite_kerghan-base/Dockerfile:5`

Patterns:
- `DL3008` — Pin versions in `apt-get install` (use `apt-get install <package>=<version>`).
- `DL3015` — Avoid installing recommended-but-not-required packages (`--no-install-recommends`).

All three lines are identical: `RUN apt-get update && apt-get install -y rsync && rm -rf /var/lib/apt/lists/*`.

## Problem
Unpinned `apt-get install` commands can silently pull in different package versions on rebuild, and installing recommended-but-not-required packages bloats the image and widens the attack/maintenance surface.

The three affected files build from two different base images on two different distros, which matters for picking the pin:
- `dockerfiles/kerghan-base/Dockerfile` and `dockerfiles/vite_kerghan-base/Dockerfile` both `FROM darthjee/node:0.2.1` → **Debian 12 (bookworm)**.
- `dockerfiles/circleci_kerghan-base/Dockerfile` `FROM darthjee/circleci_node:0.2.1` → **Ubuntu 22.04 (jammy)**.

Debian and Ubuntu package the same upstream rsync (3.2.7) under different revision suffixes, so a single version string copy-pasted across all three files would fail to resolve on at least one of them.

## Solution
For each of the three base Dockerfiles' `apt-get install` line, add `--no-install-recommends` and pin `rsync` to the version currently resolvable on that file's base distro:

- `dockerfiles/kerghan-base/Dockerfile:5` and `dockerfiles/vite_kerghan-base/Dockerfile:5` (Debian bookworm, via `darthjee/node:0.2.1`):
  `apt-get update && apt-get install -y --no-install-recommends rsync=3.2.7-1+deb12u6 && rm -rf /var/lib/apt/lists/*`
- `dockerfiles/circleci_kerghan-base/Dockerfile:5` (Ubuntu jammy, via `darthjee/circleci_node:0.2.1`):
  `apt-get update && apt-get install -y --no-install-recommends rsync=3.2.7-0ubuntu0.22.04.7 && rm -rf /var/lib/apt/lists/*`

Rebuild the affected images locally afterward to confirm the pinned versions resolve and nothing needed was dropped by skipping recommends.

## Benefits
Reproducible builds (no silent version drift on rebuild), smaller final images, and a reduced package/attack surface from dropping unneeded recommended packages.
