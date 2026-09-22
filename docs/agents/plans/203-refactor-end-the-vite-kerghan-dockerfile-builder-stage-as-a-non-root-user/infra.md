# Infra Plan: Refactor: End the vite_kerghan Dockerfile builder stage as a non-root user

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Add `USER node` to the builder stage
In `dockerfiles/vite_kerghan/Dockerfile`, add a `USER node` line immediately after `RUN /bin/bash yarn_builder.sh` (line 17) in the `builder` stage, mirroring the identical fix already applied to `dockerfiles/kerghan/Dockerfile` for issue #202 (commit b224675). This clears Hadolint DL3002 for the intermediate stage without touching the final stage, which already ends with `USER node`.

### Step 2 — Verify the built image
Run `docker-compose build kerghan_fe` and confirm the resulting image's `Config.User` is still `node` (e.g. via `docker inspect --format '{{.Config.User}}' <image>`), and that the yarn cache copied from the `builder` stage into the final image (`/usr/local/share/.cache/yarn/v6/`, owned `node:node`) is unchanged.

## Files to Change
- `dockerfiles/vite_kerghan/Dockerfile` — add `USER node` after the `RUN /bin/bash yarn_builder.sh` line in the `builder` stage.

## Notes
- Do not add a `# hadolint ignore` — the fix is a straightforward one-line addition, same as issue #202.
- This image is published (`vite_kerghan*`), so keep the change minimal — no other lines in the Dockerfile should change.
- After merge, confirm Codacy's re-analysis of `main` no longer reports the DL3002 finding for this file.
