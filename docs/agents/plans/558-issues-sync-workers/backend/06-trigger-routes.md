# Trigger routes T2, T3, T4

Implement `api/github-link.md#trigger-routes` with thin controller actions on `IssueLinksController`. Use class-level `@CachePolicy(CacheClass.UserScoped)` and the status set through `@Res({ passthrough: true })`, as `projects.controller.ts#fromRepository` does. Business logic lives in a service, either `IssueLinksService` or a new `IssueSyncTriggersService`.

- **`POST /projects/:projectId/issues/:issueId/refresh.json` (T2):**
  - The link has no marker and `lastSyncedAt` is under 60 s old: `200 { issue, alreadyFresh: true }`.
  - Otherwise, enqueue and answer `202 { issue, alreadyFresh: false }`.
- **`POST /projects/:projectId/refresh.json` (T3):** one enqueue per non-`gone` link, oldest `lastSyncedAt` first, skipping fresh marker-less links. Answer `202 { enqueued, skippedFresh }`; zeros when there are no links.
- **`POST /projects/:projectId/issues/:issueId/retry-sync.json` (T4):**
  - A `sync_failed` link is reset to `linked` with reason `null` and enqueued: `202 { issue }`.
  - A `linked` link is a no-op: `200 { issue }`.
- **Refusals,** before any reset or enqueue and with no GitHub call:
  - No link: `ISSUE_NOT_LINKED`.
  - A `gone` link (T2, T4): `ISSUE_LINK_GONE`.
  - No repository (T3): `PROJECT_HAS_NO_REPOSITORY`.
  - Repository Unavailable or dangling (T2, T3, T4): `PROJECT_REPOSITORY_UNAVAILABLE`.
  - Not found follows `IssuesAccess`.

Specs:

- **Service unit and `(db)` specs:** the fresh skip with `FakeClock`, the reset, and the refusals.
- **E2E with fakes:** extend `FakeIssueLinksService` (or add a fake for the new service) in `build-issues-test-app.ts`, plus `expectNeverCached` and `expectNoForbiddenKeys`.
- **Access matrix:** add rows to `issue-links.controller.access.e2e-spec.ts`, whose completeness check fails otherwise.
- **Link fixture:** extend `linkApi` in `link-fixture.ts` with the three routes.

## Files to Change

- `backend/src/issues/issue-links.controller.ts`
- `backend/src/issues/issue-links.service.ts` or `backend/src/issues/issue-sync-triggers.service.ts` (new), and specs
- `backend/src/issues/tests/issue-links.controller.access.e2e-spec.ts`, `backend/src/issues/tests/support/build-issues-test-app.ts`, `link-fixture.ts`
