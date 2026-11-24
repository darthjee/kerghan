# Plan: Cache yarn install in the CircleCI setup_project step

Issue: [586-cache-yarn-install-in-the-circleci-setup-project-step.md](../../issues/586-cache-yarn-install-in-the-circleci-setup-project-step.md)

## Overview

Add a `node_modules` cache to the shared `setup_project` CircleCI command. The cache is keyed on the project dir, the job image and the `yarn.lock` checksum. Also switch the install to `yarn install --frozen-lockfile`. This is a CI-only change, owned by the infra agent.

See [infra.md](infra.md) for the full plan.
