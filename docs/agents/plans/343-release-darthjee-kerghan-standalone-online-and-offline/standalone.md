# Standalone Plan: Release darthjee/kerghan-standalone (online and offline)

Main plan: [plan.md](plan.md)

## Shared contracts

- **Produced by infra:** `standalone/images/amd64/{kerghan,mysql,tent}.tar` and
  `standalone/images/arm64/{kerghan,mysql,tent}.tar`. Each holds the images for that folder's
  architecture.
- **Provided by this agent:**
  - the `standalone-offline` stage copies `standalone/images/${TARGETARCH:-amd64}/` to
    `/vault/images/`;
  - `smoke_test.sh` honors `SMOKE_EXPECT_OFFLINE=true`, as described in [plan.md](plan.md).

## Implementation Steps

### Step 1 — Per-architecture tarballs in the offline stage

In `dockerfiles/kerghan_standalone/Dockerfile`:

- Redeclare `ARG TARGETARCH` in the `standalone-offline` stage, with no default. ARGs do not carry
  over from the parent stage.
- Replace `COPY standalone/images/ /vault/images/` with
  `COPY standalone/images/${TARGETARCH:-amd64}/ /vault/images/`.
- Update the comment above the stage: `standalone/images/<arch>/` must hold the tarballs for
  that architecture, produced by `bin/release_kerghan_standalone.sh`.

Building the offline target for one architecture then copies only that architecture's
tarballs. A single `buildx --platform linux/amd64,linux/arm64` build gives each architecture
its own.

### Step 2 — Offline assertion in the smoke test

In `standalone/scripts/smoke_test.sh`:

- Add `SMOKE_EXPECT_OFFLINE` (default `false`) and document it in the header.
- When it is `true`, after `/health.json` answers 200 on first boot:
  - check that `docker exec "$CONTAINER" printenv COMPOSE_UP_ARGS` contains `--pull never`;
  - check that the inner daemon (`docker exec "$CONTAINER" docker image inspect …`) has
    `darthjee/kerghan:$KERGHAN_VERSION`, `mysql:9.3.0` and the `TENT_IMAGE` read from
    `/vault/.env`. With `--pull never`, this shows the stack started from the preloaded
    tarballs and pulled nothing.
- Fail with a clear message otherwise. Keep the default path unchanged, so
  `make standalone-smoke` behaves as it does today.

Then update `docs/agents/specs/standalone/stack.md`:

- the Dockerfile-targets bullet: per-architecture `standalone/images/<arch>/`;
- "Required tests": the CI job runs the offline smoke test on amd64; arm64 is checked by hand.

## Files to Change

- `dockerfiles/kerghan_standalone/Dockerfile`: per-architecture `COPY` in `standalone-offline`,
  plus the updated comment.
- `standalone/scripts/smoke_test.sh`: the `SMOKE_EXPECT_OFFLINE` assertions.
- `docs/agents/specs/standalone/stack.md`: images layout and the CI smoke-test note.

## CI Checks

- No CI job lints these files. Check `bash -n standalone/scripts/smoke_test.sh` and, if
  available, `shellcheck`, both through docker (for example `docker run --rm -v "$PWD:/mnt"
  koalaman/shellcheck:stable …`).
- Optional local check: build the offline target with a stub `standalone/images/amd64/` and run
  the smoke test with `SKIP_BUILD=true SMOKE_EXPECT_OFFLINE=true`.

## Notes

- The online `standalone` stage is unchanged.
- Do not add tarballs to git. `standalone/images/` stays ignored.
