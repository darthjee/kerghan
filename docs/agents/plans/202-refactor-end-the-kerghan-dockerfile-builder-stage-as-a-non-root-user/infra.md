# Infra Plan: Refactor: End the kerghan Dockerfile builder stage as a non-root user

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Reset the `builder` stage back to `node` after `yarn_builder.sh`

In `dockerfiles/kerghan/Dockerfile`, the `builder` stage sets `USER root` (line 15) so `yarn_builder.sh` can write into the global yarn cache, then ends immediately after `RUN /bin/bash yarn_builder.sh` (line 17) without resetting the user — tripping Hadolint DL3002 ("Last USER should not be root"). The **final** stage already ends `USER node` (line 26) and copies from `builder` with `--chown=node:node`, so the shipped image is unaffected; only the intermediate stage trips the rule.

Add `USER node` as a new line immediately after the `RUN /bin/bash yarn_builder.sh` line — nothing else follows it in that stage, so this is a pure appended line, not a reorder of existing instructions.

## Files to Change

- `dockerfiles/kerghan/Dockerfile` — add `USER node` after the `RUN /bin/bash yarn_builder.sh` line in the `builder` stage (after line 17).

## CI Checks

No CircleCI job runs Hadolint locally in this repo — the DL3002 finding comes from Codacy's static analysis of `main`, re-checked post-merge (see the issue's Verification section). Validate locally instead:

- Build: `docker-compose build base_build`
- Confirm the produced final image's `Config.User` is still `node` (unchanged from before this fix) — e.g. `docker inspect --format '{{.Config.User}}' <base_build image>`

## Notes

- Do not add a `# hadolint ignore=DL3002` comment — the issue explicitly says to add it only if the straightforward fix proves impossible, and it isn't needed here.
- This is a one-line, no-behavior-change fix: the final image's user and the yarn cache it copies in are unaffected, since the `builder` stage's `USER` only governs how `yarn_builder.sh` runs, not what gets copied out (`COPY --chown=node:node` already fixes ownership regardless of the builder stage's active user at COPY time).
