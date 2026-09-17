# Infra Plan: Infra: Dockerfiles pin unversioned "latest" base image tag (3 files)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Add a `BASE_VERSION` build ARG to each of the three Dockerfiles
In each of `dockerfiles/kerghan/Dockerfile`, `dockerfiles/production_kerghan/Dockerfile`, and `dockerfiles/vite_kerghan/Dockerfile`, declare `ARG BASE_VERSION=latest` before the first `FROM` instruction (Docker requires a global-scope `ARG` to precede the `FROM` that uses it), then change the base-image `FROM` line to interpolate it instead of hard-coding `latest`:

```dockerfile
ARG BASE_VERSION=latest
FROM darthjee/scripts:0.8.0 as scripts
FROM darthjee/kerghan-base:${BASE_VERSION} as base
```

(substitute `production_kerghan-base`/`vite_kerghan-base` for the other two files). Defaulting to `latest` keeps `docker-compose build`, Render's current build config, and every other existing build path behaving exactly as today — only the literal `FROM` text changes, from a bare `latest` string to a variable reference.

Do not touch `bin/image.sh`, `.circleci/config.yml`, the root `version` file, or `docker-compose.yml` — none of them need to change for this fix, and none currently pass a `BASE_VERSION` build arg (so all three Dockerfiles keep resolving to `latest` at build time, same as before).

### Step 2 — Verify Hadolint no longer flags `DL3007`, adjust if it still does
Run Hadolint locally against all three files, e.g.:

```bash
docker run --rm -i hadolint/hadolint < dockerfiles/kerghan/Dockerfile
docker run --rm -i hadolint/hadolint < dockerfiles/production_kerghan/Dockerfile
docker run --rm -i hadolint/hadolint < dockerfiles/vite_kerghan/Dockerfile
```

- If `DL3007` no longer appears in the output for these lines, the fix is complete.
- If it still fires (Hadolint resolving the `ARG`'s default value back to the literal `latest`), fall back to a per-line suppression instead: add `# hadolint ignore=DL3007` directly above the affected `FROM` line in each file, with a one-line comment explaining that `latest` is intentional here (dev convenience for `kerghan`/`vite_kerghan`; CI-ordering-guaranteed freshness for `production_kerghan` — see the issue's Problem section). This mirrors the inline-disable precedent already used in this repo for other confirmed Codacy/static-analysis false positives (see the ".codacy.yml" section of `docs/agents/architecture/infra.md`).

## Files to Change
- `dockerfiles/kerghan/Dockerfile` — add `ARG BASE_VERSION=latest`, change `FROM darthjee/kerghan-base:latest` to `FROM darthjee/kerghan-base:${BASE_VERSION}`
- `dockerfiles/production_kerghan/Dockerfile` — add `ARG BASE_VERSION=latest`, change `FROM darthjee/production_kerghan-base:latest` to `FROM darthjee/production_kerghan-base:${BASE_VERSION}`
- `dockerfiles/vite_kerghan/Dockerfile` — add `ARG BASE_VERSION=latest`, change `FROM darthjee/vite_kerghan-base:latest` to `FROM darthjee/vite_kerghan-base:${BASE_VERSION}`

## Notes
- No CircleCI job builds `dockerfiles/kerghan/Dockerfile` or `dockerfiles/vite_kerghan/Dockerfile` today (only the corresponding `*-base` images are consumed, either as executor images or not at all), so there is no CI check to run locally for this change beyond the Hadolint verification in Step 2.
- `dockerfiles/production_kerghan/Dockerfile` is built by Render at deploy time, outside this repo's CI — confirm after merging that a Render deploy still succeeds (it should, since `BASE_VERSION` defaults to `latest`, identical to current behavior).
- Actually pinning `production_kerghan`'s Render build to an explicit version (via a `BASE_VERSION` build argument in Render's dashboard settings) is an optional, manual follow-up outside this plan's scope — see the issue's Solution section.
