# Standalone Plan: Read client settings from ~/.kerghan/config

Main plan: [plan.md](plan.md)

## Overview
Add a bash-3.2-compatible config loader to `standalone/bin/kerghan`, resolve every setting as
flag > `~/.kerghan/config` > default, and use the resolved values in `up`, `down` and `reset`.
The contract is `docs/agents/specs/standalone/config.md` plus the decisions recorded in issue #345
(`image-tag` replaces only the version part; only image and port drive recreation; example ships as
`standalone/config.example`).

## Context
- #344 shipped the client: `cmd_up` parses `--offline`, `-p/--port`, `-f`; `image_ref` builds
  `darthjee/kerghan-standalone:<KERGHAN_VERSION>[-offline]`; `recreate_reason` compares the running
  image against `KERGHAN_VERSION`; `vault_cmd` runs `vault` from `~/.kerghan`.
- Vault (`darthjee/vault` CLI) accepts `--runtime auto|sysbox|privileged` on `up`/`run` and
  `--stop-timeout <seconds>` on `up`/`run`/`down`.
- Tests are bats under `standalone/test/`, with `vault`/`docker`/`openssl` stubs logging calls to
  `STUB_LOG` and a temp `HOME` (`helpers/setup.bash`).

## Steps

- [01 — Config loader and resolution](standalone/01-config-loader.md)
- [02 — image-tag and the recreate decision](standalone/02-image-tag-and-recreate.md)
- [03 — Pass runtime and stop-timeout to Vault; hints and help](standalone/03-runtime-stop-timeout-and-hints.md)
- [04 — Example config and spec updates](standalone/04-example-and-docs.md)
- [05 — bats tests](standalone/05-tests.md)

## CI Checks
- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`, runs
  `bats standalone/test`)

## Notes
- Keep bash 3.2 compatibility (no associative arrays, no `${var,,}`, no `mapfile`, guarded empty
  array expansion) — see the script header.
- Load the config only in commands that use it (`up`, `down`, `reset`), so a broken config never
  blocks `version`, `help`, `logs`, `status` or `compose`.
- A config error must exit non-zero before any `vault`/`docker` call that changes state (and
  before generating `kerghan.env`).
- Never run `bats`, `shellcheck` or other tools on the host; use `docker-compose`.
