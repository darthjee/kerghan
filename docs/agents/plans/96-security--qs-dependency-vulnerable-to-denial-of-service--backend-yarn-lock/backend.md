# Backend Plan: Security: qs dependency vulnerable to Denial of Service (backend/yarn.lock)

Main plan: [plan.md](plan.md)

## Overview

`qs` is declared as a **direct** dependency in `backend/package.json` (`"qs": "6.15.3"`) and
resolves to the same version in `backend/yarn.lock:5165`. A Trivy scan (via Codacy) flagged
`qs@6.15.3` for two Denial of Service CVEs (`CVE-2026-82417`, `CVE-2026-82562`). `qs@6.16.0` is
already published upstream and available as a direct upgrade — no transitive-dependency
resolution or `resolutions` override is needed.

## Context

- `qs` has no other declared version ranges pulling it in transitively (`yarn.lock` shows a
  single merged entry: `qs@6.15.3, qs@^6.14.1, qs@^6.15.2, qs@~6.14.0`), so bumping the direct
  `package.json` entry is sufficient to move the resolved version.
- `frontend/` does not depend on `qs` — this change is backend-only.

## Implementation Steps

### Step 1 — Bump the `qs` version

Update `backend/package.json`'s `qs` entry from `6.15.3` to `6.16.0` (or the latest patched
release available at implementation time, if `6.16.0` has since been superseded), then run
`yarn install` inside the backend container to regenerate `backend/yarn.lock`.

### Step 2 — Verify nothing regresses

Run the backend test suite and lint to confirm the bump doesn't change any observed `qs`
parsing behavior (e.g. querystring array/object parsing used by DTOs or guards, if any).

## Files to Change

- `backend/package.json` — bump `qs` from `6.15.3` to `6.16.0`.
- `backend/yarn.lock` — regenerated resolution for `qs` (and any of its own sub-dependencies).

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- No code changes are expected beyond the two dependency files — this is a pure version bump.
- If `yarn install` pulls in a `qs@6.16.0` with a changed sub-dependency tree, double check
  `yarn.lock` only shows the expected `qs` entry changing (plus its own transitive deps), not
  unrelated packages.
