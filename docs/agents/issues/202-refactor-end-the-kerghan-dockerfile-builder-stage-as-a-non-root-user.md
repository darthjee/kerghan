# Issue: Refactor: End the kerghan Dockerfile builder stage as a non-root user

## Description
Hadolint DL3002 ("Last USER should not be root") fires on the `builder` stage of `dockerfiles/kerghan/Dockerfile`.

## Problem
`dockerfiles/kerghan/Dockerfile:15` sets `USER root` in the `builder` stage so `yarn_builder.sh` can run, and the stage ends there. The **final** stage already ends with `USER node` (line 26), so the shipped image is not affected; only the intermediate stage trips the rule.

## Expected Behavior
Every stage ends as `node`; the produced image and the yarn cache copied into it are unchanged.

## Solution
Add `USER node` after the `RUN /bin/bash yarn_builder.sh` line of the `builder` stage (nothing follows it in that stage, and the next stage copies with `--chown=node:node`). Build with `docker-compose build base_build` and confirm the final image's `Config.User` is still `node`. Do not add a `# hadolint ignore` unless the change proves impossible.

## Benefits
Clears a High security finding and keeps every stage least-privilege by default.

## Verification

- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).

