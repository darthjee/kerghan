# Plan: Issues: open-issue counts and bulk close/reopen

Issue: [563-issues-open-issue-counts-and-bulk-close-reopen.md](../../issues/563-issues-open-issue-counts-and-bulk-close-reopen.md)

## Overview

The backend adds `POST /projects/:projectId/issues/bulk-state.json`, exactly as `api/issues.md#bulk-close-and-reopen` specifies, reusing the weighted edit limiter, the markers and the sync trigger of the single edit. It also adds the route's access-matrix row and the specs for E66 to E74. The frontend adds `IssuesClient.bulkState`, an "Open issues" column on project rows (the backend count already shipped in #555), and the bulk selection bar on the issue list. Both parts ship in one PR.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

Reviewers (read only): `cache` (the cache class and `X-Skip-Cache`), `security` and `data-access` (`security.md#review-checklist`).

## Shared contracts

**Route:** `POST /projects/:projectId/issues/bulk-state.json`. It is user scoped, sends `X-Skip-Cache: true` and `Cache-Control: no-store`, and runs `OriginGuard`.

**Request body:**

```json
{ "issueIds": ["8b1e…04", "…"], "state": "closed" }
```

- `issueIds`: required, an array of 1 to 100 uuid strings. Duplicates (compared case-insensitively) answer `400`.
- `state`: required, `"open"` or `"closed"`.

**`200` response.** Every requested id appears in exactly one list, lowercased, in request order:

```json
{ "state": "closed", "changed": ["…"], "unchanged": ["…"], "notFound": ["…"] }
```

**Errors:**

- `400 VALIDATION_FAILED`, with `details`
- `429 ISSUE_EDIT_RATE_LIMITED`, with `Retry-After` and `meta.retryAfterSeconds`. The weight is `issueIds.length`, and nothing is applied or consumed.
- `404 PROJECT_NOT_FOUND`, for a missing, foreign or deleted project

**Count:** `openIssueCount` (an integer, `0` included) is already on every project object and every listing row. Nothing changes in the API.
