# Plan: Refactor: dedupe repeated request/assert blocks in auth service/controller/admin specs

Issue: [175-refactor-dedupe-repeated-request-assert-blocks-in-auth-service-controller-admin-specs.md](../issues/175-refactor-dedupe-repeated-request-assert-blocks-in-auth-service-controller-admin-specs.md)

## Overview
Spec-only refactor of `backend/src/auth/tests/` and `backend/src/core/tests/`. Two techniques:

- **e2e "body + X-Skip-Cache" pairs** (recovery, account, admin): wrap the pair in a `describe` whose `beforeEach` issues the request once and stores the response; the body test and the `sets the X-Skip-Cache header` test stay as separate, named `it`s that assert against that response. Tests with a *different* request (404 for an unknown id, validation 400s, the "does not match" cases) stay outside that `describe`.
- **Repeated setup** (auth.service.spec, auth.controller.spec, logger/request-logging specs): extract local helpers (or, for the console spies shared by two files, a `*.test-support.ts` helper).

## Context
Decisions already made in the issue discussion: keep body and header as distinct `it`s (shared `beforeEach`, not a merged test — so this does **not** reduce HTTP round-trips); apply the pattern to **every** occurrence in the files named in the issue, not only the pairs jscpd flagged; specs outside those files (`authorization-request.*`, `auth.controller.refresh-logout`) and the dedicated `auth.controller.skip-cache.e2e-spec.ts` are out of scope. Do not remove coverage — only redundancy.

## Steps

- [01 — Dedupe recovery e2e spec](backend/01-dedupe-recovery-e2e-spec.md)
- [02 — Dedupe account e2e spec](backend/02-dedupe-account-e2e-spec.md)
- [03 — Dedupe admin e2e spec](backend/03-dedupe-admin-e2e-spec.md)
- [04 — Extract expired-token helper in auth.service.spec](backend/04-extract-expired-token-helper.md)
- [05 — Extract buildController helper in auth.controller.spec](backend/05-extract-build-controller-helper.md)
- [06 — Share console-spies helper](backend/06-share-console-spies-helper.md)
- [07 — Verify](backend/07-verify.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- The line numbers in the issue come from an older jscpd report and are stale (e.g. `auth.controller.guard.e2e-spec.ts` has no 32-39 block any more). jscpd is not configured locally (only via Codacy, `.codacy.yml`), so the spots in these step files were identified by reading the specs; if a leftover duplicate is suspected after the work, check Codacy's duplication view for the touched files.
- Project rule: max 300 lines per file, max complexity 10 (ESLint-enforced); JSDoc is required on helpers in `core/tests` (see `logger.service.spec.ts`), so match that.
- Only run commands via `docker-compose` (never `yarn`/`npm` on the host).
