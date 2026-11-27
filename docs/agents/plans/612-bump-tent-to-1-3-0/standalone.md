# Standalone Plan: Bump Tent to 1.3.0

Main plan: [plan.md](plan.md)

## Shared contracts

- Relies on infra's `tent=1.3.0` line in `version` and the canonical lookup (contract 1).
- Produces `/vault/.env` in the shape of contract 4, by reading `version` through the bind mount of contract 5.
- Reports to infra any standalone doc that still carries a literal Tent version after its rewrite, so it joins `bump_tent.sh`'s file list (contract 3).

## Implementation Steps

### Step 1 — Standalone stage reads one multi-arch tag from `version`

In `dockerfiles/kerghan_standalone/Dockerfile`, `standalone` stage:

- remove `ARG TARGETARCH` and its comment, the `case "${TARGETARCH}"` block and the `Unsupported TARGETARCH` error;
- replace the `RUN` that writes `/vault/.env` with one using `RUN --mount=type=bind,source=version,target=/tmp/version`, extracting `tent=` with the canonical lookup, failing with `version file has no tent= entry` when empty, and writing `TENT_IMAGE=darthjee/tent:<version>`, `KERGHAN_VERSION`, `LOGS_IMAGE=docker:27.5.1-cli` (keep the trailing `cat /vault/.env`);
- leave the `standalone-offline` stage's own `ARG TARGETARCH` and `COPY standalone/images/${TARGETARCH:-amd64}/` unchanged; update its header comment from "the matching Tent tag" to the single multi-arch Tent tag.

Verify locally: `docker build -f dockerfiles/kerghan_standalone/Dockerfile --target standalone .` produces `TENT_IMAGE=darthjee/tent:1.3.0`; temporarily removing `tent=` from `version` fails the build with the explicit message (restore it afterwards). Also build with `--platform linux/arm64` and confirm the same `TENT_IMAGE` line.

### Step 2 — Smoke test, inner compose comment, standalone docs

- `standalone/scripts/smoke_test.sh` (~line 190): tighten the assertion to `grep -qE '^TENT_IMAGE=darthjee/tent:[0-9]+\.[0-9]+\.[0-9]+$'`, with a failure message saying the tag must be a plain multi-arch `X.Y.Z` tag.
- `standalone/vault/docker-compose.yml` header: `TENT_IMAGE - darthjee/tent multi-arch tag (from the root version file)` instead of "tag matching the image's architecture".
- `docs/agents/standalone/inner-stack.md` (~lines 120–145): replace the "one tag per architecture, not a manifest" text and the `TARGETARCH` / `1.0.3-arm64` example with the single multi-arch tag read from `version` via a bind mount; remove "An unsupported `TARGETARCH` fails the build"; keep the offline stage's `${TARGETARCH:-amd64}` tarball selection.
- `docs/agents/standalone/release-and-caveats.md`: the pinned-images table's Tent row becomes one multi-arch row like the others, sourced from `version`.
- Prefer prose without a literal Tent version; if one remains, tell infra the file and line (contract 3).

## Files to Change

- `dockerfiles/kerghan_standalone/Dockerfile` — drop the architecture lookup from `standalone`, bind-mount `version`.
- `standalone/scripts/smoke_test.sh` — exact-shape `TENT_IMAGE` assertion.
- `standalone/vault/docker-compose.yml` — header comment.
- `docs/agents/standalone/inner-stack.md`, `docs/agents/standalone/release-and-caveats.md` — multi-arch prose.

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` and `docker-compose run --rm standalone_tests_bash32` (CI jobs: `standalone_tests`, `standalone_tests_bash32`) — expected unaffected, run as a regression check.

## Notes

- BuildKit is already required by this Dockerfile, so `RUN --mount=type=bind` adds no new requirement; the legacy builder was never supported for the `standalone` stage.
- The full standalone smoke test (and an arm64 smoke test) is not required by the issue; the local builds in Step 1 are.
