# Standalone Plan: Add the kerghan client CLI

Main plan: [plan.md](plan.md)

## Shared contracts

- Write `standalone/bin/kerghan` (executable, `#!/usr/bin/env bash`).
- Keep exactly one column-0 line `KERGHAN_VERSION="0.5.0"`. The infra agent's
  `bump_version.sh` rewrites it on every release, so never derive the version in any other way.
- Put the tests in `standalone/test/*.bats` (helpers in `standalone/test/helpers/`, stubs in
  `standalone/test/stubs/`). They must pass under `bats/bats:1.11.0` with only bash and bats
  available: `vault`, `docker` and `openssl` are stubbed on `PATH`.
- Run them with `docker-compose run --rm standalone_tests` (the service is added by the infra
  agent).

## Steps

- [01 — Script skeleton, argument parsing and vault mapping](standalone/01-script-skeleton.md)
- [02 — `up` decision logic](standalone/02-up-logic.md)
- [03 — bats tests](standalone/03-bats-tests.md)

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`)

## Notes

- **`vault up` is a no-op when the instance already runs**, even with a different `--image` or
  `-p`. So recreating (for an upgrade, a variant swap or a port change) must be an explicit
  `vault down` followed by `vault up` in the client.
- **Vault has no volume removal.** `reset` is `vault down --name kerghan` followed by
  `docker volume rm vault-kerghan-data`.
- **Stray `.vaultrc` / `.vault.env`:** with `--image` and no `[dir]`, Vault still reads both
  from the current directory. Run every `vault` call from `~/.kerghan` (a subshell
  `cd "$KERGHAN_HOME"`), so a `.vaultrc` in the user's working directory cannot change the name,
  image or env. Mention this in the script's header comment.
- **The image tag is not yet published.** `darthjee/kerghan-standalone:0.5.0` does not exist. The
  next tag (0.5.1) bumps the pin and publishes the image together. For manual runs before then,
  use a locally built image tagged `0.5.0`, or test only through the bats stubs. The
  `image-tag` override is #345.
- Do not touch `docker-compose.yml`, `.circleci/config.yml` or `scripts/bump_version.sh`. They
  belong to the infra agent.
