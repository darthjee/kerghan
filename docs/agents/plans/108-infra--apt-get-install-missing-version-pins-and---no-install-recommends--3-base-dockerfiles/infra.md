# Infra Plan: Infra: apt-get install missing version pins and --no-install-recommends (3 base Dockerfiles)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Pin rsync on the Debian-bookworm base files
`dockerfiles/kerghan-base/Dockerfile:5` and `dockerfiles/vite_kerghan-base/Dockerfile:5` both `FROM darthjee/node:0.2.1`, confirmed to be Debian GNU/Linux 12 (bookworm). `apt-cache policy rsync` on that image resolves the candidate to `3.2.7-1+deb12u6`. Update both lines from:

```
RUN apt-get update && apt-get install -y rsync && rm -rf /var/lib/apt/lists/*
```

to:

```
RUN apt-get update && apt-get install -y --no-install-recommends rsync=3.2.7-1+deb12u6 && rm -rf /var/lib/apt/lists/*
```

### Step 2 — Pin rsync on the Ubuntu-jammy base file
`dockerfiles/circleci_kerghan-base/Dockerfile:5` `FROM darthjee/circleci_node:0.2.1`, confirmed to be Ubuntu 22.04.3 LTS (jammy). `apt-cache policy rsync` on that image resolves the candidate to `3.2.7-0ubuntu0.22.04.7` — a different revision suffix than the Debian pin above, so it must not reuse Step 1's version string. Update the line from:

```
RUN apt-get update && apt-get install -y rsync && rm -rf /var/lib/apt/lists/*
```

to:

```
RUN apt-get update && apt-get install -y --no-install-recommends rsync=3.2.7-0ubuntu0.22.04.7 && rm -rf /var/lib/apt/lists/*
```

## Files to Change
- `dockerfiles/kerghan-base/Dockerfile` — pin `rsync=3.2.7-1+deb12u6`, add `--no-install-recommends`
- `dockerfiles/vite_kerghan-base/Dockerfile` — pin `rsync=3.2.7-1+deb12u6`, add `--no-install-recommends`
- `dockerfiles/circleci_kerghan-base/Dockerfile` — pin `rsync=3.2.7-0ubuntu0.22.04.7`, add `--no-install-recommends`

## CI Checks
These three images are only built/pushed by the `release-image` job (`.circleci/config.yml`), which is gated to semver tag builds (`filters: { tags: { only: /.*/ } }`) — it does not run on this PR. Verify locally before merging instead:
- `docker build -f dockerfiles/kerghan-base/Dockerfile . -t kerghan-base-test`
- `docker build -f dockerfiles/vite_kerghan-base/Dockerfile . -t vite_kerghan-base-test`
- `docker build -f dockerfiles/circleci_kerghan-base/Dockerfile . -t circleci_kerghan-base-test`

(mirrors the `build()` function in `bin/image.sh`, minus tagging/push)

## Notes
- `dockerfiles/production_kerghan-base/Dockerfile` has the identical unpinned `rsync` install on the same Debian-bookworm base but was deliberately kept out of this issue's scope during discussion — tracked separately as issue #126, which can reuse the same `rsync=3.2.7-1+deb12u6` pin.
- The two pin values were confirmed live via `docker pull` + `apt-cache policy rsync` against `darthjee/node:0.2.1` and `darthjee/circleci_node:0.2.1` while discussing #108; if those base image tags change before this is implemented, re-check `apt-cache policy rsync` rather than assuming the pins still resolve.
