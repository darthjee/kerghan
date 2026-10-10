# Infra Plan: Release darthjee/kerghan-standalone (online and offline)

Main plan: [plan.md](plan.md)

## Shared contracts

- **Produced by this agent:** `standalone/images/amd64/{kerghan,mysql,tent}.tar` and
  `standalone/images/arm64/{kerghan,mysql,tent}.tar`. Each holds the images for that folder's
  architecture.
- **Provided by the standalone agent:**
  - the `standalone-offline` stage copies `standalone/images/${TARGETARCH:-amd64}/`;
  - `smoke_test.sh` accepts `SMOKE_EXPECT_OFFLINE=true`.
- **How this agent runs the smoke test:**
  - `IMAGE=$DOCKER_ID_USER/kerghan-standalone:<v>-offline`
  - `SKIP_BUILD=true`
  - `KERGHAN_VERSION=<v>`
  - `SMOKE_EXPECT_OFFLINE=true`

## Steps

- [01 — Release script](infra/01-release-script.md)
- [02 — CircleCI job](infra/02-circleci-job.md)
- [03 — Infra docs](infra/03-infra-docs.md)

## CI Checks

- `.circleci/config.yml`: run `circleci config validate` through docker if available. The real
  job only runs on a semver tag.
- `bin/release_kerghan_standalone.sh`: `bash -n` and `shellcheck`, both through docker.

## Notes

- Use `darthjee/kerghan:<v>`, never `latest`. It is pushed by `release-kerghan`, which this job
  requires.
- Disk: three tarballs per architecture, plus the images, fit easily on the machine executor.
- Only `latest` / `latest-offline` wait for the smoke test. `<v>` and `<v>-offline` are pushed
  before it runs, because a multi-arch manifest must be pushed before it can be pulled. If the
  smoke test fails, the versioned tags stay up and `latest` is not moved.
