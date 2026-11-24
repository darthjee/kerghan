# Plan: Fix release

Issue: [589-fix-release.md](../../issues/589-fix-release.md)

## Overview

Make `save_image` in `bin/release_kerghan_standalone.sh` pull each architecture by its per-platform manifest digest (read from the registry), then tag, check and save it. The `release-kerghan-standalone` job then works on both the classic and the containerd Docker image store. Add bats coverage for `save_image` and update the infra docs. All the work is in the infra agent's scope.

See [infra.md](infra.md) for the full plan.
