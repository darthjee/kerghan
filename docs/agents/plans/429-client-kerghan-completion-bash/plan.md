# Plan: Client: `kerghan completion bash`

Issue: [429-client-kerghan-completion-bash.md](../../issues/429-client-kerghan-completion-bash.md)

## Overview

Add `kerghan completion bash` and the `_kerghan` completion function to `standalone/bin/kerghan`. The specs in `docs/agents/specs/auto-complete/` are the source of truth: `command.md`, `completion.md`, `contracts.md`, `security.md` and README `## Testing`. The standalone agent writes the client, the test helper and the four `completion*.bats` files. The infra agent adds a real bash 3.2 run of those files, both locally (docker-compose) and in CircleCI.

**Prerequisite:** #434 (the word-list constants and the documented `BASH_SOURCE` guard) must be merged into `main` before implementation starts. Read the constant names from the client as merged; don't assume the names used in this plan.

## Agents involved

- [standalone](standalone.md)
- [infra](infra.md)

## Shared contracts

- **Test glob:** the bash 3.2 run executes exactly `standalone/test/completion*.bats`. Every client completion test lives in a file matching it. `install_completion.bats` (#430) starts with `install_`, so the glob leaves it out.
- **Environment:** the bash 3.2 run sets `KERGHAN_TEST_BASH32=1`. `completion_safety.bats` has the `bash 3.2 guard` test, which is skipped unless that variable is set and then asserts `BASH_VERSINFO[0] -eq 3`.
- **bash on `PATH`:** inside the 3.2 environment, `bash` on `PATH` (and so `#!/usr/bin/env bash`, the client's shebang, and bats' own shebang) must be bash 3.2.57. No other bash may be installed. Never `apk add bash` or a package that depends on it, `bats` included.
- **bats version:** bats-core `v1.11.0`, the same pin as `bats/bats:1.11.0`, installed from the upstream tag with its `install.sh`.
- **Tools the tests use:** BusyBox `find`, `stat`, `mktemp`, `diff`, `grep`, `sed` and `env` from the Alpine base image. If a test needs anything else, standalone tells infra and it's added to both the Dockerfile and the CircleCI job.
- **Names:**
  - image `dockerfiles/bats_bash32/Dockerfile`;
  - docker-compose service `bats_bash32`;
  - CircleCI job `standalone_completion_bash32`.
