# Issue: Refactor: Upgrade multer 2.2.0 to 2.3.0 (four published CVEs)

## Description
`backend/package.json` already carries a yarn `resolutions` entry pinning `multer` to `2.2.0` (there is no direct `dependencies` entry for it — `multer` only ever arrives transitively, via `@nestjs/platform-express`). Trivy reports that pinned `2.2.0` as vulnerable.

## Problem
Trivy findings on `backend/yarn.lock:4790` (all fixed in 2.3.0):

- CVE-2026-77037 — DoS via file descriptor leak on aborted uploads (High)
- CVE-2026-77078 — DoS via crafted multipart field names (High)
- CVE-2026-82333 — DoS via oversized array index in field names (High)
- CVE-2026-77063 — file size limit bypass via async `fileFilter` race (minor)

The `resolutions` entry exists specifically because `@nestjs/platform-express` declares its own `multer` dependency pinned to an exact version — checked the npm registry, and every published `11.x` release of `@nestjs/platform-express`, up through the latest (`11.2.5`), still pins that internal dependency to exactly `2.2.0`. Only `@nestjs/platform-express@12.0.4` moves off it (to `multer@2.4.0`), and that requires bumping the whole `@nestjs/*` family to a new major version — out of scope for this CVE fix. So the fix must go through the existing `resolutions` override, not a `dependencies` entry (there isn't one to bump).

## Expected Behavior
The resolved `multer` version is `2.3.0` or later everywhere in the dependency tree — no nested `2.2.0` copy remains anywhere, including under `@nestjs/platform-express` — and Trivy no longer reports these CVEs.

## Solution
- In `backend/package.json`, bump the existing `resolutions.multer` value from `2.2.0` to `2.3.0` (or a `^2.3.0` range).
- Regenerate `backend/yarn.lock` inside the container (`docker-compose run --rm kerghan_tests yarn install`), never on the host.
- After regenerating, confirm `backend/yarn.lock` contains no remaining `multer@2.2.0` entry anywhere (top-level or nested under `@nestjs/platform-express`).
- Do not attempt to fix this by upgrading `@nestjs/platform-express` itself — the only upstream release with a different `multer` dependency is `12.0.4`, which requires a Nest `11`→`12` major upgrade; that belongs in a separate issue if ever pursued.
- Verify: `docker-compose run --rm kerghan_tests yarn lint` and `docker-compose run --rm kerghan_tests yarn coverage` pass, with coverage not reduced. After merge, confirm Codacy's re-analysis of `main` no longer reports the CVEs listed under **Problem**.

## Benefits
Removes three High and one minor known vulnerability from the backend dependency tree via a one-line bump to the existing `resolutions` override.
