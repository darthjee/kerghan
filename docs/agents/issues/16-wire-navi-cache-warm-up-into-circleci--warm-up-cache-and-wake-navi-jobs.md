# Wire Navi cache warm-up into CircleCI (warm-up-cache and wake-navi jobs)

## Context

`docs/agents/cache-warmer.md` already documents a `warm-up-cache` job and a `wake-navi` job as
part of Kerghan's CircleCI pipeline — including exactly which image each uses, what they run,
and how they gate on the release tag filter — mirroring the pattern Majora already runs in
production. The two shell scripts these jobs depend on, `scripts/warm_navi_cache.sh` and
`scripts/wake_navi.sh`, already exist in the repo and match the documented behavior (`config`
pushes every file in `RESOURCE_FILES` via `navi-client -a config`, `engine-start` triggers the
warm-up for the build's namespace, and `wake_navi.sh` polls `$NAVI_URL` until it stops
responding `502`).

What's missing is the actual CircleCI wiring: `.circleci/config.yml` has neither job, so Navi's
cache is never warmed after a release and the documentation describes a job graph that doesn't
exist yet. This leaves the Tent proxy cache cold after every production release until the first
real user request repopulates it.

## What needs to be done

- **Infra**: Add a `warm-up-cache` job to `.circleci/config.yml`, using `darthjee/navi-hey-client:latest`
  as the job's docker executor, gated behind `requires: [release]` and the existing
  `filters: *tags_only` semver-tag gate. Before invoking `navi-client`, compute
  `NAVI_NAMEPACE="${KERGHAN_NAMESPACE}-${CIRCLE_WORKFLOW_WORKSPACE_ID}"` (per-build namespace
  slice, matching `cache-warmer.md`'s documented convention) and export it for the script. Run
  `scripts/warm_navi_cache.sh config` followed by `scripts/warm_navi_cache.sh engine-start`.
- **Infra**: Add a `wake-navi` job using `cimg/base:current`, running `scripts/wake_navi.sh`
  against `$NAVI_URL`, with no `requires:` (so it starts early and doesn't gate or get gated by
  anything else), but positioned so `warm-up-cache` only needs Navi awake by the time it runs
  (i.e. add it to the `workflows.test.jobs` list without wiring it into `requires:` chains).
- **Infra**: Confirm `$KERGHAN_NAMESPACE`, `$NAVI_URL`, and `$NAVI_API_TOKEN` are documented as
  required CircleCI Project Settings → Environment Variables (same convention already used for
  `$KERGHAN_PRODUCTION_URL`), and add them to `docs/agents/environment-variables.md` if not
  already listed there.
- **Docs**: Once wired, verify `docs/agents/cache-warmer.md`'s "CI (CircleCI)" section still
  matches the implementation exactly (job names, images, gating, namespace computation) — update
  it if anything drifts during implementation.
- Do **not** create `scripts/warm_navi_cache.sh` or `scripts/wake_navi.sh` — both already exist
  in `scripts/` and match the documented/expected behavior; only the CircleCI job definitions
  and workflow wiring are missing.

## Acceptance criteria

- [ ] `.circleci/config.yml` has a `warm-up-cache` job using `darthjee/navi-hey-client:latest`,
      gated on `requires: [release]` and the semver tag filter, that runs
      `scripts/warm_navi_cache.sh config` then `scripts/warm_navi_cache.sh engine-start` with
      `NAVI_NAMEPACE` computed from `$KERGHAN_NAMESPACE` and `$CIRCLE_WORKFLOW_WORKSPACE_ID`.
- [ ] `.circleci/config.yml` has a `wake-navi` job using `cimg/base:current` that runs
      `scripts/wake_navi.sh`, added to the workflow without a `requires:` gate.
- [ ] `$KERGHAN_NAMESPACE`, `$NAVI_URL`, and `$NAVI_API_TOKEN` are documented as required
      CircleCI project environment variables.
- [ ] `docs/agents/cache-warmer.md`'s CI section still accurately describes the implemented jobs
      after this change.
