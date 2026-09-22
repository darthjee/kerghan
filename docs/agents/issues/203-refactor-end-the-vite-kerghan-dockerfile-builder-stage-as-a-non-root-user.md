# Issue: Refactor: End the vite_kerghan Dockerfile builder stage as a non-root user

## Description
Hadolint DL3002 ("Last USER should not be root") fires on the `builder` stage of `dockerfiles/vite_kerghan/Dockerfile`.

## Problem
`dockerfiles/vite_kerghan/Dockerfile:15` sets `USER root` in the `builder` stage and the stage ends there. The final stage already ends with `USER node` (line 26), so only the intermediate stage trips the rule. This image is one of the published ones (`vite_kerghan*`), so keep the change minimal.

## Expected Behavior
Every stage ends as `node`; the produced image and the yarn cache copied into it are unchanged.

## Solution
Add `USER node` after the `RUN /bin/bash yarn_builder.sh` line of the `builder` stage (mirrors the fix already applied to `dockerfiles/kerghan/Dockerfile` for issue #202). Build with `docker-compose build kerghan_fe` and confirm the final image's `Config.User` is still `node`. Do not add a `# hadolint ignore` unless the change proves impossible.

## Benefits
Clears a High security finding and keeps every stage least-privilege by default.
