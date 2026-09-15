# Issue: Complexity: authorization-request.service.spec.ts is 664 lines — split into focused spec files

## Description
Codacy's Lizard complexity check (`file-nloc-medium`) flags `backend/src/auth/tests/authorization-request.service.spec.ts` for its size. At the time the finding was raised the file was 664 non-comment lines; it has since grown further (819 lines as of this writing) as more auth scenarios were added, which underlines the problem rather than changing it.

## Problem
AGENTS.md caps files at 300 lines, and this spec file is now more than 2.5x that limit. A single file covering all of `AuthorizationRequestService`'s public methods (`create`, `poll`, `listOpenForUser`, `authorize`, `deny`) is hard to navigate, and its size makes merge conflicts more likely as more scenarios are added to any of those methods.

## Solution
Split `authorization-request.service.spec.ts` into one focused spec file per public method of `AuthorizationRequestService`, named with a dot-suffix and kept flat alongside the existing files in `backend/src/auth/tests/`:
- `authorization-request.service.create.spec.ts`
- `authorization-request.service.poll.spec.ts`
- `authorization-request.service.listOpenForUser.spec.ts`
- `authorization-request.service.authorize.spec.ts`
- `authorization-request.service.deny.spec.ts`

Extract the shared test scaffolding currently at the top of the file (`RepoMock`, `repoMock()`, `queryBuilderMock()`, `sha256()`, and the `beforeEach` that constructs `AuthorizationRequestService`/`AuthorizationRequestAbuseGuardService`) into a new helper file, e.g. `backend/src/auth/tests/authorization-request.service.test-support.ts`, imported by each of the 5 new spec files. No new folder — this helper is scoped to this service's tests only. No behavior or test-coverage change — this is a pure file-organization refactor.

## Benefits
- Each spec file stays close to (or under) the repo's 300-line cap, matching AGENTS.md.
- Easier to navigate: a reviewer or contributor working on one method (e.g. `authorize`) only opens that method's spec file.
- Fewer merge conflicts when multiple people add scenarios to different methods at the same time.
