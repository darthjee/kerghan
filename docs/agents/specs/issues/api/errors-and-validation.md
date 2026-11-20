# Issues and Projects API — Errors and validation

The error catalogue and the input validation rules. Back to the [Issues and Projects API](../api.md) hub.

## Error catalogue

Standard error shape ([backend.md](../../../architecture/backend.md#error-responses)) plus the new optional `error.meta` ([Refusal data](projects.md#refusal-data-errormeta)). New codes join `ErrorCodes` (`core/error-codes.ts`); their helpers live in `issues/issues-http-errors.ts`, like `repositories/repositories-http-errors.ts`. The `502`/`503` reuse `githubUnavailable()`/`githubRateLimited()` from `core/github-http-errors.ts`.

| Status | Code | Message | `meta` | Where |
|---|---|---|---|---|
| `400` | `VALIDATION_FAILED` (existing) | standard | | Any body or path id (non-uuid) failing [Input validation](errors-and-validation.md#input-validation) |
| `401` | `UNAUTHORIZED` (existing) | standard | | No session (`JwtGuard`) |
| `403` | `FORBIDDEN` (existing) | standard | | Foreign origin (`OriginGuard`) |
| `404` | `NOT_FOUND` (existing) | `Project not found` | | Project missing, another user's or deleted, on every `/projects/:projectId/…` route |
| `404` | `NOT_FOUND` (existing) | `Issue not found` | | Issue missing or in another project (the project resolved) |
| `404` | `NOT_FOUND` (existing) | `Repository not found` | | Repo ref not among the caller's rows (same message as Add) |
| `404` | `GITHUB_ISSUE_NOT_FOUND` | `GitHub issue not found` | | Import/attach: not found, `410`, non-rename `301` (E57) |
| `409` | `PROJECTS_LIMIT_REACHED` | `You reached the maximum number of projects` | | Create, shortcut (not the shortcut's existing-project `200`) |
| `409` | `ISSUES_LIMIT_REACHED` | `This project reached the maximum number of issues` | | Issue create, import |
| `409` | `PROJECT_NAME_TAKEN` | `A project with this name already exists` | | Create, shortcut, edit |
| `409` | `PROJECT_REPOSITORY_TAKEN` | `This repository already has a project` | `projectId` | Explicit create, repository change |
| `409` | `PROJECT_REPOSITORY_NOT_ADDED` | `Add this repository first` | | Create, shortcut, repository change |
| `409` | `PROJECT_HAS_LINKS` | `Unlink the project's issues before changing its repository` | `linkCount` | Repository change or detach with links (E62) |
| `409` | `PROJECT_HAS_NO_REPOSITORY` | `This project has no repository` | | Import, attach, project refresh |
| `409` | `PROJECT_REPOSITORY_UNAVAILABLE` | `The project's repository is unavailable` | | Import, attach, refreshes, retry sync |
| `409` | `PROJECT_REPOSITORY_CHANGED` | `The project's repository changed; try again` | | Import/attach race with a repository change (E62) |
| `409` | `GITHUB_ISSUE_ALREADY_LINKED` | `This GitHub issue is already linked` | `projectId`, `issueId` | Import, attach (E4, E46) |
| `409` | `ISSUE_ALREADY_LINKED` | `This issue is already linked` | | Attach (E64) |
| `409` | `ISSUE_ATTACH_CONFIRMATION_REQUIRED` | `Attaching replaces this issue's values` | `differences`, `updatedAt` | Attach with differing values and a missing or stale confirmation (E61) |
| `409` | `ISSUE_NOT_LINKED` | `This issue is not linked` | | Unlink, refresh, retry sync (E64) |
| `409` | `ISSUE_UNLINK_HAS_UNSENT_CHANGES` | `This issue has changes not yet sent to GitHub` | | Unlink without `discardUnsentChanges` (E63) |
| `409` | `ISSUE_LINK_GONE` | `The GitHub issue is no longer available` | | Refresh, retry sync on a `gone` link |
| `409` | `ISSUE_LINKED` | `Unlink this issue before deleting it` | | Issue delete |
| `409` | `GITHUB_CREDENTIAL_UNUSABLE` | `The integration for this repository needs attention` | `reason` | Import/attach: no usable integration, `401`, `403` (E59) |
| `422` | `GITHUB_ISSUE_IS_PULL_REQUEST` | `This is a pull request, not an issue` | | Import, attach (E3) |
| `502` | `GITHUB_UNAVAILABLE` (existing) | existing | | Import/attach: timeout, network, `5xx`, unclassifiable `301` (E60) |
| `429` | `ISSUE_LINK_RATE_LIMITED` | `Too many link requests; try again later` | | Import, attach; with `Retry-After` and `retryAfterSeconds` |
| `429` | `ISSUE_EDIT_RATE_LIMITED` | `Too many edits; try again later` | | Issue edit; with `Retry-After` and `retryAfterSeconds` |
| `503` | `GITHUB_RATE_LIMITED` (existing) | existing | | Import/attach rate limited (E58), with `retryAfterSeconds` |

- 21 new codes; none is used outside this module.
- **Not-found messages:** project first, then issue, so a foreign project never reveals its issues. The issue lookup is always inside the resolved project.
- `meta` values are public ids (uuids), counts, field names, timestamps or the sync reason vocabulary; never internal ids, GitHub content or credential material.
- Messages are final English strings; the UI may map codes to its own wording ([ui.md](../ui/states.md#empty-loading-and-error-states)).
- Sync failures in jobs never become HTTP errors: they show only in the [link object](github-link.md#link-object).

## Input validation

Every failure answers `400 VALIDATION_FAILED` (with `error.details`) before any lookup, write or GitHub call. Unknown properties are stripped. **Types are strict:** a value of the wrong JSON type (`"1"` for a number, `"true"` for a boolean) is rejected, never coerced.

**Lengths count Unicode code points,** matching MySQL's `varchar` under utf8mb4. class-validator's `MaxLength` counts UTF-16 units (an emoji counts twice), so the DTOs use a code-point validator; a 4-byte character counts once (E14 of [edge-cases.md](../edge-cases.md)).

| Field | Routes | Rule |
|---|---|---|
| Path `:projectId`, `:issueId` | all nested routes | A uuid (`ParseUUIDPipe`). |
| `name` | project create, shortcut, edit | String, trimmed, 1 to 100 code points after trimming; blank rejected. Required on explicit create, optional on the shortcut (default `owner/name`) and edit; `null` rejected. |
| `description` | project create, shortcut, edit | String or `null`, trimmed, at most 2000 code points; blank or `null` is stored as none. |
| `repository` | create, shortcut, repository | A [repo ref](../../../backend/routes/repositories/identity-and-sync.md#repo-ref) object with its own rules. Optional on explicit create (absent or `null` is a non-code project); required and non-null on the shortcut; required on the repository route, where `null` detaches. |
| `title` | issue create, edit | String, trimmed, 1 to 256 code points after trimming; blank rejected. Required on create; optional on edit, where `null` is rejected. |
| `body` | issue create, edit | String or `null`, at most 65536 code points, **not trimmed** (Markdown whitespace is content). Exactly `''` or `null` is stored as `NULL`; whitespace-only bodies are kept as they are. The same normalization function as for GitHub values ([sync.md](../sync.md#fields-and-ownership)). |
| `state` | issue create, edit | `open` or `closed`; default `open` on create. |
| `number` | import, attach | Integer, 1 to 2147483647 (the `int` `github_number` column). |
| `confirmUpdatedAt` | attach | Optional ISO 8601 UTC timestamp with milliseconds, as returned in `updatedAt`; compared as an instant. |
| `discardUnsentChanges` | unlink | Optional boolean; only `true` discards. |
| `page`, `perPage` | both listings | Integers; `page` ≥ 1 (default 1), `perPage` 1 to 100 (default 50). |
| `state` (filter) | issue listing | `open` (default), `closed` or `all`. |
| `search` | both listings | String, trimmed, at most 100 code points; empty means no search; `LIKE` metacharacters escaped. |

- **Output timestamps** are ISO 8601 UTC strings. An issue's `updatedAt` carries milliseconds (`datetime(3)`); other timestamps carry the second precision of their columns.
- No content rules beyond these (no markup stripping or control-character filtering): titles and bodies may hold Markdown, and how they are rendered is decided in [security.md](../security.md#bodies-restricted-markdown).
- Validation runs on input only. Values pulled from GitHub are stored as GitHub returns them, and an edit sends only the fields it changes, so an inbound value outside these rules (an untrimmed title, for instance) never blocks an unrelated edit.
