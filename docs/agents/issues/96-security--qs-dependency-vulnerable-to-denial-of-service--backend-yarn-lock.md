# Issue: Security: qs dependency vulnerable to Denial of Service (backend/yarn.lock)

## Description
A Trivy vulnerability scan (via Codacy) flagged the `qs` package pinned in `backend/yarn.lock` for two Denial of Service CVEs:

- `CVE-2026-82417` — qs: Denial of Service via improper input validation
- `CVE-2026-82562` — qs: Denial of Service via array limit handling

`qs` is a **direct** dependency of the backend, declared in `backend/package.json` as `"qs": "6.15.3"`, and resolved to the same version in `backend/yarn.lock:5165`.

## Problem
The pinned `qs@6.15.3` is vulnerable to the two DoS CVEs above. A patched release, `qs@6.16.0`, is already published upstream.

## Solution
- Bump the `qs` dependency in `backend/package.json` from `6.15.3` to `6.16.0` (or the latest patched release available at implementation time).
- Update `backend/yarn.lock` accordingly (`yarn install`/`yarn upgrade qs`).
- Re-run `docker-compose run --rm kerghan_tests yarn test` to confirm nothing relying on `qs` parsing behavior regresses.

## Benefits
- Closes both DoS CVEs (`CVE-2026-82417`, `CVE-2026-82562`) flagged by the Codacy/Trivy scan.
- Keeps the backend's querystring parsing dependency on a maintained, patched release.
