# Plan: Add the kerghan client CLI

Issue: [344-add-the-kerghan-client-cli.md](../../issues/344-add-the-kerghan-client-cli.md)

## Overview

Add `standalone/bin/kerghan`, a bash 3.2 wrapper around the `vault` CLI that starts, stops,
upgrades and resets the `darthjee/kerghan-standalone` instance (spec:
`docs/agents/specs/standalone/client.md`, minus `~/.kerghan/config`, which is #345). The
standalone agent writes the script and its bats tests. The infra agent adds the
`standalone_tests` compose service, the CircleCI job that runs it, and the
`scripts/bump_version.sh` hook that keeps the pinned image version in step with the release.

## Agents involved

- [standalone](standalone.md)
- [infra](infra.md)

## Shared contracts

- **Script path:** `standalone/bin/kerghan`, executable (`git update-index --chmod=+x`),
  shebang `#!/usr/bin/env bash`.
- **Version line:** exactly one line, at column 0, of the form
  `KERGHAN_VERSION="X.Y.Z"` (double quotes, no `export`, no trailing comment). Its initial value
  is the README's current version, `0.5.0`. `scripts/bump_version.sh` rewrites it with
  `sed -i '' "s|^KERGHAN_VERSION=\"[0-9.]*\"|KERGHAN_VERSION=\"${new_version}\"|"`.
- **Tests:** bats files in `standalone/test/*.bats`, with helpers and stubs in
  `standalone/test/helpers/` and `standalone/test/stubs/`. The tests are self-contained: they
  need only bash and bats (no `docker`, `vault` or `openssl` on the image, since all three are
  stubbed on `PATH`), and they run from any working directory.
- **Test command:** `bats /standalone/test` with `./standalone` mounted at `/standalone`.
  - Compose service: `standalone_tests`, image `bats/bats:1.11.0`. The image's entrypoint is
    `bats`, so `command: /standalone/test`.
  - Local run: `docker-compose run --rm standalone_tests`.
  - CI job: `standalone_tests`, image `bats/bats:1.11.0`, on all branches and tags. It is
    added to the `requires` of `release-kerghan-standalone`.
