# Infra Plan: Build the standalone Vault stack and Dockerfile

Main plan: [plan.md](plan.md)

## Shared contracts

- You rely on `standalone/scripts/smoke_test.sh` (env inputs `IMAGE`, `KERGHAN_VERSION`,
  `SMOKE_PORT`, `SKIP_BUILD`) and on the build command
  `docker build -f dockerfiles/kerghan_standalone/Dockerfile --target standalone --build-arg KERGHAN_VERSION=<v> -t <IMAGE> .`.
- You produce the `build-standalone` and `standalone-smoke` make targets, with
  `STANDALONE_IMAGE?=darthjee/kerghan-standalone:dev` and `KERGHAN_VERSION?=latest`.

## Implementation Steps

### Step 1 — Add the standalone make targets

Add a `# ── Standalone ──` section to the root `Makefile` with `build-standalone` (the build
command above, `DOCKER_BUILDKIT=1`) and `standalone-smoke` (calls the smoke script with the two
variables). Add both to `.PHONY`. Add a one-line comment that `standalone-smoke` needs
`--privileged` support on the host Docker and that the CI job lands in #343.

### Step 2 — Document the targets

Mention the two targets where the Makefile targets are documented for agents (e.g.
`.claude/agents/infra.md` / `AGENTS.md`, whichever lists make targets today), keeping the note
short.

## Files to Change

- `Makefile` — new `build-standalone` and `standalone-smoke` targets, `.PHONY`.
- `.claude/agents/infra.md` or `AGENTS.md` — list the new targets (only where make targets are
  already listed).

## Notes

- Do not touch `.circleci/config.yml` here: the CircleCI smoke job is #343's.
- Do not invoke the script on the host beyond `docker` itself; it only calls `docker` and `curl`.
