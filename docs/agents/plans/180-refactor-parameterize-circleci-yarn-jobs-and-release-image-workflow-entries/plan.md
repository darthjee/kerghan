# Plan: Refactor: parameterize CircleCI yarn jobs and release-image workflow entries

Issue: [180-refactor-parameterize-circleci-yarn-jobs-and-release-image-workflow-entries.md](../../issues/180-refactor-parameterize-circleci-yarn-jobs-and-release-image-workflow-entries.md)

## Overview
Collapse the four duplicated yarn job bodies into one parameterised `yarn_project` job (sharing a folder-swap/install `command` with `upload_fe_files`), collapse the eight `release-image` workflow entries into one `matrix`, and add a `circleci-cli` docker-compose service so the result can be validated through Docker. All existing job names and Docker tags stay identical.

See [infra.md](infra.md) for the full plan.
