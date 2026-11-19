# Issues and Projects — Security

Security rules and decisions of the feature (decided in #490).
Part of the [Issues and Projects specs](../issues.md).

## Principles

- Every read and write is scoped to the owning user.
- GitHub credentials stay in the backend: every GitHub call that uses a user's credential is made by the backend inside the Integrations module.
- No endpoint returns a credential or anything derived from it beyond the masked `secretHint`.
- The frontend never calls GitHub with a credential.
- Rate-limit pauses and waiting sets are keyed by integration id only. Credentials are resolved at job time inside the Integrations module and never stored by Issues ([sync.md](sync.md#rate-limits)).
- Another user's or a deleted project answers 404 ([projects.md](projects.md#deletion)). The not-found order is project first, then issue, so a foreign project never reveals its issues; an issue of another project answers the same `404`.
- Path ids are uuids (a malformed one answers `400`); responses never expose internal ids, `user_id` or integration fields, and `error.meta` carries only uuids, counts, field names, timestamps or reasons, never internal ids, GitHub content or credentials ([api.md](api.md#exposed-identifiers)).
- Sharing guardrails ([projects.md](projects.md#room-for-sharing-members-and-roles)): one access check for every project and issue read or write, with no scattered `user_id` filters; issues derive access from their project; the owner's credentials do all GitHub work and link uniqueness stays per owner; the actor is not assumed to equal the owner.
- A revoked, invalid, missing or read-only credential never retries and never leaks: the job stops, the marker is kept and the link shows a credential reason (E19 to E21 of [edge-cases.md](edge-cases.md)). Only a `401` invalidates an integration.
- A not-found answer on link creation never reveals more than the owner's credential can read, the owner's credentials do the read, and no GitHub content reaches logs or job params ([github-link.md](github-link.md#compatibility-performance-and-security)).
- A `404` never discards a marker without a successful repository read with the same credential (E22).
- Jobs make no GitHub call for a user who is not `approved` (E24).
- No table has a secret column; markers carry no payload.
- The link's `user_id` is for uniqueness only, never for authorization.

## Write access to GitHub

### Write capability by credential type

| Credential | Write to issues | Known before a push |
|---|---|---|
| OAuth app | Yes (`repo` scope, required at callback) | Yes |
| Classic PAT | Yes (`repo` scope, checked at creation) | Yes (`scopes`) |
| Fine-grained PAT | Only if the user granted Issues: write | No (`permissionsVerified: false`) |
| GitHub App | Yes once the installation accepts Issues: write | Yes (`metadata.permissions`, as recorded) |

### The GitHub App gains Issues: write

- The app is registered with **Issues: write** and **Metadata: read**, nothing else. Installations are still accepted with `issues` set to `read` or `write` (unchanged rule), so an installation whose owner has not accepted the updated permissions on GitHub keeps working for reads; its pushes get a `403` and end `sync_failed` with reason `forbidden`.
- **Installation tokens are minted per operation with the least permission it needs:** `getIssue` and `probeIssues` with `{ issues: read, metadata: read }`, `updateIssue` with `{ issues: write }`. The existing listing tokens keep `{ metadata: read }`. The in-memory token cache is keyed by installation **and** permission set, so a write token is never reused for a read path or the other way round. Tokens stay in process memory inside the Integrations module ([architecture/security.md](../../architecture/security.md#github-credentials-stay-in-the-backend)).
- `modules/integrations/github-app.md` ("Required permissions") and `github-service.md` (token minting) describe today's code, so the implementation updates them in the change that builds it; this spec records the decision.

### Candidate order

Candidates for a reconcile are ordered by known write capability, oldest first within a group (the rule itself is in [sync.md](sync.md#integration-selection)): known writable (OAuth app, classic PAT, GitHub App with `issues: write`), then unknown (fine-grained PAT), then known read-only (GitHub App with `issues: read`). The recorded permissions can be stale; the `403` fallback moves to the next candidate, so a stale record never causes a wrong outcome.

### Reactive only, no up-front warning

- Link creation does not warn about a read-only credential and no `writeAccess` field is exposed: capability is unknowable for fine-grained PATs and can be stale for the App.
- The failure is shown when it happens: a push that gets a `403` sets `sync_failed` with reason `forbidden` (E5, E21), the UI points to Integrations ([ui.md](ui.md#link-and-sync-states)), and the marker is kept until a push succeeds or the user unlinks with confirmation.

### What works without a write-capable credential

- Everything local: projects, issues, edits (which create markers), unlinking, deletion.
- Every GitHub read: import, attach, refresh (T2, T3) and retry sync, with any usable credential that lists the repository.
- Only the push fails, as `forbidden`, with no retry loop and no loss of the unsent change. A refresh never clears that failure while the marker exists ([sync.md](sync.md#retries-and-sync_failed)).

### How a write-capable credential is obtained

No new flow. The user adds or fixes an integration in Integrations: an OAuth app, a classic PAT with `repo`, a fine-grained PAT granted Issues: write on the repository, or accepts the GitHub App's updated permissions on GitHub. Fixing a credential does not push by itself (E19); the user runs retry sync.

## The Integrations boundary

The "Fixed operations: `GET`-only" guarantee of [architecture/security.md](../../architecture/security.md#github-credentials-stay-in-the-backend) is narrowed, not dropped. Every other guarantee (nothing sensitive leaves the module, owner-scoped loads, safe log fields, no generic `request(path)`) stays.

### Reads and the one write are separate services

- **`IntegrationsGithubService` stays `GET`-only**: the existing listings plus `getIssue` and `probeIssues`.
- **`updateIssue` lives on a separate exported `IntegrationsGithubIssueWriter`**, the only service in the codebase that sends a non-`GET` request to GitHub with a user's credential. Importing the read service never grants a write.
- **Only the issues sync service injects the writer**, enforced by a `(static)` spec next to the Repositories module-boundary tooling ([repositories.md](../../modules/repositories.md#module-boundaries)).

### What the write may send

- **One endpoint:** `PATCH /repos/{owner}/{name}/issues/{number}` on the fixed base `https://api.github.com`.
- **Path from stored rows only:** `owner`/`name` from the project's repository row and `number` from the link, each URL-encoded; never from a request body, a path parameter or a GitHub response other than the classified rename.
- **Body allowlist:** only `title`, `body` and `state` (`open`/`closed`), each optional, built from the diff ([sync.md](sync.md#fields-and-ownership)). Never `state_reason`, labels, assignees, milestone or any other field. The writer rejects anything else before any call.
- **Owner's credential only:** the integration is loaded with `WHERE id = ? AND user_id = ?` for the project owner, as for reads; the actor is never assumed to be the owner.

### Redirects never carry a credential off GitHub

- No HTTP client follows a redirect automatically. A `301` is classified by its `Location` ([github-link.md](github-link.md#gone-transferred-and-repository-unreachable)).
- A rename is followed once only when the `Location` is `https://api.github.com/` with the rename form and the same repository id and issue number. Any other scheme, host, port or path shape is **unclassifiable**: not followed, the credential is not sent, and the outcome is GitHub unavailable (E65). This applies to reads and to the write.
- The write follows the rename with the same body; it is idempotent (fixed values), so the retry is safe.

## GitHub and user content

Issue titles and bodies come from two untrusted sources: the user (typed in Kerghan) and GitHub (written by anyone who can comment on or edit the issue there). Both are stored verbatim ([sync.md](sync.md#fields-and-ownership)) and handled the same way on output.

### Titles

Always plain text (React text nodes), on every screen, in the document title and in any notification. GitHub titles are not Markdown.

### Bodies: restricted Markdown

Bodies render as GitHub-flavoured Markdown (paragraphs, headings, emphasis, lists, block quotes, code spans and blocks without syntax highlighting, tables, strikethrough, task lists, autolinked `http`/`https` URLs) under these rules:

| Input | Output |
|---|---|
| Raw HTML (inline or block, including `<script>`, `<iframe>`, `<details>`) | Shown as escaped text, never interpreted. No `rehype-raw` or equivalent. |
| Link with `http:`, `https:` or `mailto:` | A link with `rel="noopener noreferrer"` and `target="_blank"`. |
| Link with any other scheme (`javascript:`, `data:`, `vbscript:`, `file:`), a relative URL or a protocol-relative URL | Its text only, no link. Relative URLs would resolve against Kerghan's origin. |
| Image | Never loaded. Rendered as a link labelled with its alt text (or "image") when its URL is `http`/`https`, otherwise as text. No request leaves the browser for an image, so no IP or Referer leaks to third parties, and private attachments that need GitHub auth are not fetched. |
| Task list checkbox | Rendered disabled (read-only); toggling would edit the body. |
| `@mention`, `#123`, commit SHA | Plain text; no autolinking to GitHub in v1. |

- **No `dangerouslySetInnerHTML`** anywhere in the Issues components, and no HTML string is ever built from content.
- **Library:** `react-markdown` with `remark-gfm` (a new frontend dependency, version pinned per the frontend conventions and installed through `docker-compose`, never on the host). The rules above are the contract; the config (`urlTransform`, `components` overrides for `a` and `img`, no raw-HTML plugin) is how the implementation meets them.
- One shared `IssueBody` component renders every body, so the rules have a single home.
- The project description stays plain text, never Markdown ([projects.md](projects.md#fields)).

### The GitHub link

The link object's `url` is built by the backend from the stored repository `owner`/`name` and the issue number, URL-encoded, always `https://github.com/…`. The frontend opens it with `rel="noopener noreferrer"` and `target="_blank"` and renders nothing for a value that does not start with `https://github.com/`.

### Content never leaves through side channels

- No title, body or GitHub response body appears in logs, job params, error messages or `error.meta` (`meta.differences` names fields only). Validation messages name the field and the rule, never echo the value.
- **Pushing is the user's own act on GitHub.** A pushed body is written with the owner's credential, so its `@mentions` and `#references` notify and cross-link on GitHub exactly as if the owner had typed it there. This is documented, not prevented.

## Data at rest

### No encryption of issue content

- `issues.title`, `issues.body` and the link's base snapshot (`base_title`, `base_body`, `base_state`) are stored in clear, as Repositories stores private repository metadata ([model.md](model.md#performance-and-security)). They are protected by the API's single access check and by database access control.
- **Covered:** every access through the API (owner only, `404` otherwise). **Not covered:** someone with direct database or backup access, the same accepted exposure as Repositories. Encrypting content needs its own product decision and threat model; it would also break the title search of [api.md](api.md) and the sync's byte-for-byte comparisons.
- No secret column exists in the module, and credentials stay encrypted in Integrations (unchanged).

### Project deletion removes the issues at once

- **Deleting a project hard-deletes its issues**, with their links and markers, in the same transaction that sets `deleted_at` and `deleted_token`. Private titles and bodies leave the database immediately; there is nothing to purge later.
- Order inside the transaction, in lock order: lock the project row; count the issues that have markers (the `unsentIssueCount` the response reports); delete the markers, the links and the issues; clear `description` to `NULL`; set `deleted_at` and `deleted_token`.
- **The project row stays as a tombstone** (id, uuid, user, name, repository reference, timestamps) so the live-uniqueness indexes, the `404` for a deleted project and the no-op of queued jobs keep working. Nothing reads its `description`, so it is cleared.
- No restore and no purge in v1; since the issues are gone, a future restore would restore an empty project.
- Queued or in-flight jobs for the project's links find no link and are no-ops (E32, E44).
- User deletion (`user.deleted`) is unchanged: it removes projects, including tombstones, and everything under them.

## Quotas and abuse limits

### Per-user caps on stored data

| Cap | Env var | Default | Refusal |
|---|---|---|---|
| Live projects per user | `KERGHAN_ISSUES_MAX_PROJECTS_PER_USER` | 100 | `409 PROJECTS_LIMIT_REACHED` |
| Issues per project | `KERGHAN_ISSUES_MAX_ISSUES_PER_PROJECT` | 5000 | `409 ISSUES_LIMIT_REACHED` |

- Same shape as `KERGHAN_INTEGRATIONS_MAX_PER_USER` (`409 INTEGRATIONS_LIMIT_REACHED`). Read once with `getNumberConfig`; a non-positive or non-integer value falls back to the default.
- **Checked inside the creating transaction, under the lock that serializes creations:** projects under the user row lock already taken by `lockExistingUser` (both creation routes; the shortcut's "existing project, `200`" path is not a creation and is never refused); issues under the project row lock (create and import). Simultaneous creations therefore cannot overshoot.
- **Import checks the issue cap before the GitHub call** (a cheap pre-check outside the transaction) and again under the lock, so a full project costs no GitHub request.
- Tombstones do not count. Lowering a cap below a user's current count keeps existing rows and refuses new ones.
- The caps also bound storage (5000 issues x 65536-character bodies, doubled by the base snapshot for linked issues) and the size of a project refresh (T3).

### Request rate limits

| Limit | Env vars (defaults) | Refusal |
|---|---|---|
| Link creation (import and attach share one window) | `KERGHAN_ISSUES_LINK_MAX_PER_WINDOW` (30), `KERGHAN_ISSUES_LINK_WINDOW_MS` (60000) | `429 ISSUE_LINK_RATE_LIMITED` |
| Issue edits | `KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW` (120), `KERGHAN_ISSUES_EDIT_WINDOW_MS` (60000) | `429 ISSUE_EDIT_RATE_LIMITED` |

- In-memory, per-process fixed windows per user through the shared `Clock`, like `RepositoryAddRateLimiter`: no table, reset on restart, counted per backend instance, expired windows swept.
- **Checked after DTO validation and before the access check**, as Repositories Add does, so every attempt counts and the limit also bounds probing. Both `429`s carry `Retry-After` and `error.retryAfterSeconds`.
- Link creation is limited because each attempt makes one GitHub request with the owner's credential. Edits are limited because each one on a linked issue writes the marker and enqueues a job.
- Refresh (T2, T3) and retry sync (T4) stay unlimited, as decided in [api.md](api.md): the 60-second fresh skip, the per-link dedupe below and the per-integration pause bound their GitHub calls.

### Queued jobs are deduplicated per link

- The per-link dedupe is **mandatory**: while a reconcile for a link is queued and not yet started, enqueuing the same link again is a no-op. The link leaves the queued set when its job starts, so an edit that lands during a running job still enqueues the next one (T6 is unaffected).
- Every trigger goes through it (T1 to T6 and the rate-limit timer). The in-memory queue therefore holds at most one waiting job per link, whatever the edit, refresh or boot traffic.
- Per process, lost on restart (boot re-enqueues every marker once). Correctness still never depends on it (E13): duplicates across instances remain harmless.

## Logs and job params

### What may be logged

| Source | Fields allowed | Never |
|---|---|---|
| Access log (existing middleware, unchanged) | `method`, `path` without query, `statusCode`, `requestId` | Bodies. Paths of Issues routes carry only uuids and fixed segments. |
| Issues jobs (`issues.reconcile`) | `jobId`, `linkId`, outcome kind, error class | Titles, bodies, owner/name, URLs, ETags, credentials |
| Issues services (warn/error) | Internal ids (`userId`, `projectId`, `issueId`, `linkId`, `integrationId`), outcome or refusal kind, error class and code | The same as above, plus any exception message |
| Integrations (existing) | Integration id, operation (`getIssue`, `probeIssues`, `updateIssue`), HTTP status, result kind | Request or response bodies, headers, URLs, tokens |
| `user.deleted` listener failure (existing) | `userId`, error class | |

- Job params are `{ linkId }` only.
- Internal ids are allowed in logs (they never reach responses). Repository `owner`/`name` are not logged, because for a private repository they are private metadata; `linkId` or `projectId` identifies the row.
- Refusals (`4xx`), cap hits and rate-limit hits are not logged beyond the access line, whose status code already records them. This keeps a flood of refused requests from flooding the logs.

### Exception messages never reach the logs

- **Duplicate keys are mapped, never re-thrown.** Every unique index of the module (project name, project repository, link per user and GitHub issue, link per issue, marker per link, the two uuid indexes) has its `ER_DUP_ENTRY` caught at the write and mapped to its `409` (or the shortcut's re-read), so it never reaches the unhandled-exception path. MySQL's message for that error contains the duplicated value, which can be a project name.
- **Issues services log `error.constructor.name` and the driver `code`, never `error.message`**, for any database or unexpected error they log themselves. An error that escapes to the global filter is logged there as today; the duplicate-key mapping is what keeps content out of that path.

## Review checklist

The feature-specific checks the `security` and `data-access` agents apply when the implementation spawned by #492 is reviewed. Their generic definitions are stale (they predate credentials, sessions and TypeORM); refreshing them is #505, and until then the implementation's review prompt points both agents at this section.

### `security` agent

1. Every Issues route: `JwtGuard` (no `@Public()`/`@AdminOnly()`), `OriginGuard`, `@CachePolicy(CacheClass.UserScoped)`, `POST` only, `X-Skip-Cache` on success and handler errors.
2. No non-`GET` GitHub call outside `IntegrationsGithubIssueWriter`, and only the issues sync service injects it; the `PATCH` body is the `title`/`body`/`state` allowlist; the path comes from stored rows.
3. No redirect followed automatically; a `301` `Location` off `https://api.github.com` sends no credential.
4. Installation tokens are minted per operation with the least permission (`issues: read` for reads, `issues: write` only for `updateIssue`), cached by installation and permission set, never persisted.
5. No credential, title, body, owner/name, URL, ETag or exception message in logs, job params, errors or `error.meta`; duplicate keys are mapped, never re-thrown.
6. Bodies render only through the shared component under the restricted-Markdown rules; no `dangerouslySetInnerHTML`, no raw-HTML plugin, no image loaded; titles and descriptions are text.
7. Input: DTO rules of [api.md](api.md) (strict types, code-point lengths), `ParseUUIDPipe` on path ids, `LIKE` metacharacters escaped in searches, values only as bound parameters.
8. Caps checked under the creation lock; both rate limiters before the access check; the per-link job dedupe in place.

### `data-access` agent

1. Every project and issue read or write goes through the single access check (owner only); no scattered `user_id` filters; issues are looked up inside the path's project.
2. Another user's project, a deleted project and an issue of another project answer the same `404`; the not-found order (project, then issue) reveals nothing about a foreign project.
3. No response contains an internal id (project, issue, repository, link, marker, integration), a `user_id`, an integration field or credential material; `error.meta` carries only uuids, counts, field names, timestamps or reasons.
4. The repo ref resolves only among the caller's own repository rows; a rejected ref reveals no more than Repositories' Add.
5. GitHub work uses the project owner's integrations whatever the actor; the link's `user_id` is used for uniqueness only, never for authorization.
6. Project deletion removes the issues, links and markers; a tombstone is unreachable; `user.deleted` removes everything of the user.
7. Admins have no access to anyone's projects or issues.

## Not decided

Deferred, with no owner issue: encryption of issue content; a restore or purge of deleted projects; Markdown features beyond the listed ones (syntax highlighting, autolinking `@mentions` and `#references`, image proxying).

## Open questions

None owned by #490. Wording and placement of warnings and the "Fix it in Integrations" pointer are decided in [ui.md](ui.md#link-and-sync-states); refreshing the `security` and `data-access` agent definitions is #505.

## Required tests

Credentials and access:

- No credential appears in any response, job param or log (the canary sweep of [testing.md](testing.md#security-verification)); logs carry only the allowlisted fields and job params only `{ linkId }`.
- A revoked, missing or read-only credential stops the job without retry and keeps the marker (E19 to E21); a `404` with a failing issues probe discards no marker (E22); a non-approved user's job makes no call (E24).
- No response, including `error.meta`, contains an internal id, `user_id`, an integration field or credential material (canary sweep and the route matrix of [api.md](api.md#required-tests)).
- A project and its issues go through the single access check, and a non-owner gets 404 for both (the route access matrix and the two-user baseline of [testing.md](testing.md#security-verification)).
- No `fetch`, `secret_iv` or `NOW(` in the Issues sources, no Integrations or Auth mapping, and no secret or payload column `(static)`.
- A not-found answer on link creation reveals nothing beyond what the owner's credential can read, and the read uses the owner's credentials (E57, E59).

Write access and the Integrations boundary:

- `(static)`: only the issues sync service injects `IntegrationsGithubIssueWriter`; `IntegrationsGithubService` has no non-`GET` call.
- The writer sends only `title`, `body` and `state`, rejects any other field before a call, and builds the path from stored rows (unit with the fake GitHub client).
- A `301` whose `Location` is on another host, scheme or port is not followed and sends no credential (contract and unit); a rename on `api.github.com` is followed once for a read and for a write.
- Installation tokens are minted with `issues: read, metadata: read` for `getIssue`/`probeIssues` and `issues: write` for `updateIssue`, and the cache never reuses a token across permission sets (unit).
- Candidate order by known write capability, with the `403` fallback to the next candidate ([sync.md](sync.md#required-tests)).

Content:

- Frontend unit, one per row of the rendering table: raw HTML shown as text; `javascript:`, `data:`, relative and protocol-relative links rendered as text; `http`/`https`/`mailto` links carry `rel="noopener noreferrer"`; an image produces no `<img>` and no network request; task list checkboxes are disabled; `@mention` and `#123` are plain text.
- Frontend `(static)`: no `dangerouslySetInnerHTML` and no raw-HTML plugin in the Issues components; titles and project descriptions are rendered as text.
- A link `url` not starting with `https://github.com/` renders nothing.
- Backend: no title, body or GitHub body in any log line or error message (the content canary of [testing.md](testing.md#security-verification)).

Data at rest:

- `(db)`: deleting a project deletes its issues, links and markers in one transaction, clears its description, keeps the tombstone, and reports `unsentIssueCount` counted before the delete.
- `(db)`: after deletion no `issues` row of the project remains; the name and repository can be reused at once.
- A job enqueued before the deletion is a no-op after it `(race)`.

Quotas and limits:

- The 101st live project and the 5001st issue of a project are refused with `409`; tombstones do not count; the shortcut's existing-project `200` is never refused; simultaneous creations at the cap never overshoot `(db)`; a full project's import makes no GitHub call.
- The 31st link creation and the 121st edit in a window answer `429` with `Retry-After` and `retryAfterSeconds`; the window follows the `FakeClock`; the env overrides apply; a rate-limited request makes no lookup and no GitHub call.
- Enqueuing a queued link is a no-op; an edit during a running job enqueues once more; a burst of edits leaves one waiting job.

Logs:

- The content canary: a project name, description, issue title and body, and a repository owner/name carrying canary strings are run through every route and through the reconcile job, including refusals and failures, and no log line contains any of them.
- `(db)`: each unique index's duplicate answers its mapped `409` (or the shortcut's `200`) and logs nothing containing the duplicated value.
- A `4xx` refusal produces only the access line.
