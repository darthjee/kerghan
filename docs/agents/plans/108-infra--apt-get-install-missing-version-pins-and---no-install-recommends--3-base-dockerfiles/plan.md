# Plan: Infra: apt-get install missing version pins and --no-install-recommends (3 base Dockerfiles)

Issue: [108-infra--apt-get-install-missing-version-pins-and---no-install-recommends--3-base-dockerfiles.md](../../issues/108-infra--apt-get-install-missing-version-pins-and---no-install-recommends--3-base-dockerfiles.md)

## Overview
Pin the `rsync` package version and add `--no-install-recommends` to the `apt-get install` line in the three base Dockerfiles flagged by Hadolint (DL3008, DL3015), using the version resolvable on each file's own base distro.

See [infra.md](infra.md) for the full plan.
