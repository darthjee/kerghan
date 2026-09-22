# Plan: Refactor: Upgrade multer 2.2.0 to 2.3.0 (four published CVEs)

Issue: [201-refactor-upgrade-multer-2-2-0-to-2-3-0-four-published-cves.md](../../issues/201-refactor-upgrade-multer-2-2-0-to-2-3-0-four-published-cves.md)

## Overview
Bump the existing yarn `resolutions.multer` override in `backend/package.json` from `2.2.0` to `2.3.0`, regenerate `backend/yarn.lock` inside the container, and verify no vulnerable copy remains anywhere in the tree (including nested under `@nestjs/platform-express`, which pins its own `multer` dependency to the exact vulnerable version through its latest `11.x` release).

See [backend.md](backend.md) for the full plan.
