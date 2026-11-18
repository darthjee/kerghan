# Issue: Enhance the Issues specs: security

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is first defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`). This issue is documentation only: no code, migrations or endpoints.

Enhance `docs/agents/specs/issues/security.md` (created by the first sub-issue of the epic): resolve its open questions, fill gaps and make it precise enough for an implementation issue to build against without making its own decisions.

Focus:
- User scoping: every project and issue read or write is scoped to its owner, and another user's data answers 404.
- Credentials: they stay in the backend inside the Integrations module; no endpoint returns a credential or anything derived from it beyond the masked `secretHint`; the frontend never calls GitHub with a credential.
- Write access to GitHub: how a write-capable credential is obtained and what is allowed without one.
- Content from GitHub and from users: validation and output handling.
- Logs: safe fields only.
- Which of the existing review checklists apply (data access, security).

Keep the other spec files consistent: when a decision here changes another file, update it in the same PR. Specs describe decisions, not code, and the file must keep its "Required tests" section up to date.

Responsible agent: `architect`. Builds on the API spec. Review the result with the `security` and `data-access` agents' criteria in mind.

## Problem

`docs/agents/specs/issues/security.md` lists principles and four open questions owned by #490 (write-capable credentials, retention, encryption and quotas, rendering of GitHub content), and `api.md`, `model.md`, `sync.md`, `github-link.md` and `testing.md` defer the same questions to it. The feature also changes a documented security rule: `IntegrationsGithubService` is `GET`-only today, and sync needs a `PATCH`. An implementation issue cannot build the feature securely without those decisions.

## Expected Behavior

- `security.md` has no unresolved open questions, or lists any that remain with the reason and the issue that will settle them.
- The "Required tests" section matches the rules in the file.
- Related spec files are consistent with it.
- No code, migrations or endpoints are added.

### Scope boundaries

**In scope (this issue, documentation only):**

- Rewrite `docs/agents/specs/issues/security.md` with every decision above (write access, the Integrations boundary, content handling, data at rest, quotas and limits, logs, the review checklist), close its four open questions and bring its "Required tests" up to date.
- Consistency edits to the other spec files in the same PR, as listed in each section:
  - `sync.md`: candidate order by known write capability; `updateIssue` on `IntegrationsGithubIssueWriter` with per-operation token permissions; the redirect host check; mandatory per-link job dedupe; the five new env vars in Configuration; close the GitHub App write question; Job logs point to the log table.
  - `github-link.md`: the GitHub App has Issues: write (and the not-yet-accepted installation case); an unclassifiable `Location` includes another host; close "Rendering of GitHub content".
  - `model.md`: project deletion hard-deletes issues, links and markers and clears the description (Cleanup, edge row 7, Required tests); content stored unencrypted as decided; close both #490 open questions; the fold list also covers "Fixed operations: `GET`-only" in `architecture/security.md`.
  - `projects.md`: Deletion and its tests follow the hard delete and the tombstone.
  - `api.md`: four new codes and their place in the order of checks; rendering mentions point to `security.md`; close its #490 open question.
  - `testing.md`: close its #490 open question; the content canary; the frontend rendering specs; the security verification references the review checklist.
  - `edge-cases.md`: E13 notes the mandatory dedupe; rows stating that a deleted project's issues remain are updated.
  - `ui.md`: bodies render through the shared component.
  - `issues.md`: the index marks `security.md` decided.

**Out of scope:**

- Code, migrations, DTOs, `ErrorCodes`, the frontend dependency and endpoints (implementation is spawned by #492).
- Permanent docs that describe today's code, updated by the implementation in the change that builds them: `architecture/security.md` ("Fixed operations"), `modules/integrations/github-app.md` (Required permissions), `modules/integrations/github-service.md` (token minting, the writer), `environment-variables.md` (the five env vars).
- The GitHub App registration change itself (an operational step on GitHub, done with the implementation).
- Refreshing the `security` and `data-access` agent definitions (#505).
- Wording and placement of states, warnings and the "Fix it in Integrations" pointer (#491).
- Encryption of issue content, a restore or purge of deleted projects, Markdown features beyond the listed ones (syntax highlighting, autolinking `@mentions` and `#references`, image proxying): not in v1, no owner issue.

## Solution

Rewrite `security.md` with the decisions below (settled in the enhancement dialogue), and apply the consistency edits listed under Scope boundaries in the same PR. The stale reviewer agent definitions are refreshed separately in #505.

### Decisions already made in the epic

- A project is the home of issues; every Kerghan issue belongs to exactly one project. A project may be about code or anything else.
- Project to repository: 0 or 1 linked repository (one of the user's repository rows). A project with no repository is a non-code project. Whether one repository may back several projects of the same user is open.
- Ownership: one user, private (another user's project answers 404). Sharing, members and roles are out of scope, but the spec must not make them impossible later.
- Creation: explicit (optionally picking an added repository, the only way to make a non-code project), plus a shortcut that creates a project from an added repository.
- Issue to GitHub issue: one to one, per user (unique on user and GitHub issue); the link is optional; it can be created from a GitHub issue or by attaching one to an existing Kerghan issue; the GitHub issue must belong to the project's linked repository.
- Sync is two-way; the details (fields, conflict rules, states) are decided in the enhancement issues.
- Workers (from #479, in-process, in-memory queues): on-demand triggers only; outbound writes use a durable pending marker in the database that is re-enqueued at boot; rate limits reuse `retryAfterSeconds` with retry and cooldown, and exhausted retries mark the link as sync failed; jobs receive ids only, and credentials stay in the Integrations module.
- `product.md` says issue data is not persisted by default; this epic changes that and the specs must say what is now stored.

### Write access to GitHub (decided)

#### Write capability by credential type

| Credential | Write to issues | Known before a push |
|---|---|---|
| OAuth app | Yes (`repo` scope, required at callback) | Yes |
| Classic PAT | Yes (`repo` scope, checked at creation) | Yes (`scopes`) |
| Fine-grained PAT | Only if the user granted Issues: write | No (`permissionsVerified: false`) |
| GitHub App | Yes once the installation accepts Issues: write | Yes (`metadata.permissions`, as recorded) |

#### The GitHub App gains Issues: write

- The app is registered with **Issues: write** and **Metadata: read**, nothing else. Installations are still accepted with `issues` set to `read` or `write` (unchanged rule), so an installation whose owner has not accepted the updated permissions on GitHub keeps working for reads; its pushes get a `403` and end `sync_failed` with reason `forbidden`, as today.
- **Installation tokens are minted per operation with the least permission it needs:** `getIssue` and `probeIssues` with `{ issues: read, metadata: read }`, `updateIssue` with `{ issues: write }`. The existing listing tokens keep `{ metadata: read }`. The in-memory token cache is keyed by installation **and** permission set, so a write token is never reused for a read path or the other way round. Tokens stay in process memory inside the Integrations module ([architecture/security.md](../architecture/security.md#github-credentials-stay-in-the-backend)).
- `modules/integrations/github-app.md` ("Required permissions") and `github-service.md` (token minting) describe today's code, so the implementation updates them in the change that builds it; the spec records the decision.

#### Candidate order (replaces sync.md's "write-capable types first")

Candidates for a reconcile are ordered by **known write capability**, oldest first within a group:

1. Known writable: OAuth app; classic PAT; GitHub App whose recorded installation permissions have `issues: write`.
2. Unknown: fine-grained PAT.
3. Known read-only: GitHub App whose recorded permissions have `issues: read`.

The recorded permissions can be stale (an owner who accepts the update on GitHub is seen at the next test connection). This never causes a wrong outcome: the credential-only fallback of [sync.md](../specs/issues/sync.md#integration-selection) moves to the next candidate on a `403`, and the aggregate reason stays `forbidden` only when every candidate refuses.

#### No up-front warning (reactive only)

- github-link.md's decision stands: link creation does not warn about a read-only credential, and no `writeAccess` field is exposed. Capability is unknowable for fine-grained PATs and can be stale for the App, so a proactive flag would sometimes be wrong.
- The failure is shown when it happens: a push that gets a `403` sets `sync_failed` with reason `forbidden` (E5, E21), the UI points to Integrations (#491), and the marker is kept until a push succeeds or the user unlinks with confirmation.

#### What works without a write-capable credential

- Everything local: projects, issues, edits (which create markers), unlinking, deletion.
- Every GitHub read: import, attach, refresh (T2, T3) and retry sync, with any usable credential that lists the repository.
- Only the push fails, as `forbidden`, with no retry loop and no loss of the unsent change. A refresh never clears that failure while the marker exists ([sync.md](../specs/issues/sync.md#retries-and-sync_failed)).

#### How a write-capable credential is obtained

No new flow. The user adds or fixes an integration in Integrations: an OAuth app, a classic PAT with `repo`, a fine-grained PAT granted Issues: write on the repository, or accepts the GitHub App's updated permissions on GitHub. Fixing a credential does not push by itself (E19); the user runs retry sync.

#### Spec edits in the same PR

- `security.md`: close "How is a write-capable credential requested".
- `sync.md`: the candidate order above; close "Whether the GitHub App gets issue write permission"; the GitHub issue client operations note the per-operation token permissions.
- `github-link.md`: "The GitHub App is registered with Issues: read…" becomes Issues: write, with the not-yet-accepted installation case.

### The Integrations boundary (decided)

The "Fixed operations: `GET`-only" guarantee of [architecture/security.md](../architecture/security.md#github-credentials-stay-in-the-backend) is narrowed, not dropped. Every other guarantee (nothing sensitive leaves the module, owner-scoped loads, safe log fields, no generic `request(path)`) stays.

#### Reads and the one write are separate services

- **`IntegrationsGithubService` stays `GET`-only**: the existing listings plus `getIssue` and `probeIssues`.
- **`updateIssue` lives on a separate exported `IntegrationsGithubIssueWriter`**, the only service in the codebase that sends a non-`GET` request to GitHub with a user's credential. Importing the read service never grants a write.
- **Only the issues sync service injects the writer**, enforced by a `(static)` spec next to the Repositories module-boundary tooling ([repositories.md](../modules/repositories.md#module-boundaries)).
- `sync.md`'s "GitHub issue client operations" moves `updateIssue` to the writer; the result kinds are unchanged.

#### What the write may send

- **One endpoint:** `PATCH /repos/{owner}/{name}/issues/{number}` on the fixed base `https://api.github.com`.
- **Path from stored rows only:** `owner`/`name` from the project's repository row and `number` from the link, each URL-encoded; never from a request body, a path parameter or a GitHub response other than the classified rename.
- **Body allowlist:** only `title`, `body` and `state` (`open`/`closed`), each optional, built from the diff ([sync.md](../specs/issues/sync.md#fields-and-ownership)). Never `state_reason`, labels, assignees, milestone or any other field. The writer rejects anything else before any call.
- **Owner's credential only:** the integration is loaded with `WHERE id = ? AND user_id = ?` for the project owner, as for reads; the actor is never assumed to be the owner.

#### Redirects never carry a credential off GitHub

- No HTTP client follows a redirect automatically. A `301` is classified by its `Location` ([github-link.md](../specs/issues/github-link.md#gone-transferred-and-repository-unreachable)).
- A rename is followed once only when the `Location` is `https://api.github.com/` with the rename form and the same repository id and issue number. Any other scheme, host, port or path shape is **unclassifiable**: not followed, the credential is not sent, and the outcome is GitHub unavailable (E65). This applies to reads and to the write.
- The write follows the rename with the same body; it is idempotent (fixed values), so the retry is safe.

#### Spec edits in the same PR

- `security.md`: the narrowed rule, the writer split, the body allowlist and the redirect rule, with their tests.
- `sync.md`: `updateIssue` on `IntegrationsGithubIssueWriter`; the redirect host check.
- `github-link.md`: the unclassifiable `Location` explicitly includes another host.
- `model.md` fold list: `architecture/security.md`'s "GitHub credentials stay in the backend" entry also covers rewriting "Fixed operations: `GET`-only" at fold time (#492). `architecture/security.md` itself describes today's code and is not edited here.

#### Required tests (added to security.md)

- `(static)`: only the issues sync service injects `IntegrationsGithubIssueWriter`; `IntegrationsGithubService` has no non-`GET` call.
- The writer sends only `title`, `body` and `state`, rejects any other field before a call, and builds the path from stored rows (unit with the fake GitHub client).
- A `301` whose `Location` is on another host, scheme or port is not followed and sends no credential (contract and unit); a rename on `api.github.com` is followed once for a read and for a write.

### GitHub and user content (decided)

Issue titles and bodies come from two untrusted sources: the user (typed in Kerghan) and GitHub (written by anyone who can comment on or edit the issue there). Both are stored verbatim ([sync.md](../specs/issues/sync.md#fields-and-ownership)) and handled the same way on output.

#### Titles

- Always plain text (React text nodes), on every screen, in the document title and in any notification. GitHub titles are not Markdown.

#### Bodies: restricted Markdown

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
- The project description stays plain text, never Markdown ([projects.md](../specs/issues/projects.md#fields)).

#### The GitHub link

- The link object's `url` is built by the backend from the stored repository `owner`/`name` and the issue number, URL-encoded, always `https://github.com/…`. The frontend opens it with `rel="noopener noreferrer"` and `target="_blank"` and renders nothing for a value that does not start with `https://github.com/`.

#### Content never leaves through side channels

- No title, body or GitHub response body appears in logs, job params, error messages or `error.meta` (`meta.differences` names fields only). Validation messages name the field and the rule, never echo the value.
- **Pushing is the user's own act on GitHub.** A pushed body is written with the owner's credential, so its `@mentions` and `#references` notify and cross-link on GitHub exactly as if the owner had typed it there. This is documented, not prevented.

#### Spec edits in the same PR

- `security.md`: close "How is GitHub-sourced content handled and rendered", with the rules above and their tests.
- `github-link.md`: close "Rendering of GitHub content".
- `testing.md`: close its #490 open question; the frontend static spec extends to bodies.
- `api.md`: the two "#490's" mentions on rendering point to `security.md`.
- `ui.md`: the issue view renders bodies through the shared component.

#### Required tests (added to security.md)

- Frontend unit, one per row of the table: raw HTML shown as text; `javascript:`, `data:`, relative and protocol-relative links rendered as text; `http`/`https`/`mailto` links carry `rel="noopener noreferrer"`; an image produces no `<img>` and no network request; task list checkboxes are disabled; `@mention` and `#123` are plain text.
- Frontend `(static)`: no `dangerouslySetInnerHTML` and no raw-HTML plugin in the Issues components; titles and project descriptions are rendered as text.
- A link `url` not starting with `https://github.com/` renders nothing.
- Backend: no title, body or GitHub body in any log line or error message (extends the canary sweep of [testing.md](../specs/issues/testing.md#security-verification) with a content canary).

### Data at rest (decided)

#### No encryption of issue content

- `issues.title`, `issues.body` and the link's base snapshot (`base_title`, `base_body`, `base_state`) are stored in clear, as Repositories stores private repository metadata. They are protected by the API's single access check and by database access control.
- **Covered:** every access through the API (owner only, `404` otherwise). **Not covered:** someone with direct database or backup access, the same accepted exposure as Repositories. Encrypting content needs its own product decision and threat model; it would also break the title search of [api.md](../specs/issues/api.md) and the sync's byte-for-byte comparisons.
- No secret column exists in the module, and credentials stay encrypted in Integrations (unchanged).

#### Project deletion removes the issues at once

- **Deleting a project hard-deletes its issues**, with their links and markers, in the same transaction that sets `deleted_at` and `deleted_token`. Private titles and bodies leave the database immediately; there is nothing to purge later.
- Order inside the transaction, in lock order: lock the project row; count the issues that have markers (the `unsentIssueCount` the response reports); delete the markers, the links and the issues; clear `description` to `NULL`; set `deleted_at` and `deleted_token`.
- **The project row stays as a tombstone** (id, uuid, user, name, repository reference, timestamps) so the live-uniqueness indexes, the `404` for a deleted project and the no-op of queued jobs keep working. Nothing reads its `description`, so it is cleared.
- No restore and no purge in v1 (unchanged); since the issues are gone, a future restore would restore an empty project.
- Queued or in-flight jobs for the project's links find no link and are no-ops (unchanged, E32, E44).
- User deletion (`user.deleted`) is unchanged: it removes projects, including tombstones, and everything under them.

#### Spec edits in the same PR

- `model.md`: Cleanup "Project deletion (soft)" becomes the order above; remove "The `issues` rows stay, unreachable, with no purge in v1" and the Required tests line "project soft delete … keeps the `issues` rows"; edge row 7 ("the old project's issue rows stay, unreachable") becomes "were deleted with the project"; Performance and security says "stored unencrypted, decided in security.md"; close both #490 open questions (retention; encryption, with quotas moving to the quotas decision).
- `projects.md` Deletion: "Its issues are kept in the database but are unreachable" becomes "Its issues, links and markers are deleted; the project row stays as a tombstone with its description cleared". Required tests follow.
- `security.md`: close "Retention" and the encryption half of "Encryption at rest … and quotas"; replace "stored unencrypted, like Repositories' private metadata" with the decision and its accepted exposure.
- `edge-cases.md`: any row stating that a deleted project's issues remain is updated.

#### Required tests

- `(db)`: deleting a project deletes its issues, links and markers in one transaction, clears its description, keeps the tombstone, and reports `unsentIssueCount` counted before the delete.
- `(db)`: after deletion no `issues` row of the project remains; the name and repository can be reused at once.
- A job enqueued before the deletion is a no-op after it `(race)`.

### Quotas and abuse limits (decided)

#### Per-user caps on stored data

| Cap | Env var | Default | Refusal |
|---|---|---|---|
| Live projects per user | `KERGHAN_ISSUES_MAX_PROJECTS_PER_USER` | 100 | `409 PROJECTS_LIMIT_REACHED` |
| Issues per project | `KERGHAN_ISSUES_MAX_ISSUES_PER_PROJECT` | 5000 | `409 ISSUES_LIMIT_REACHED` |

- Same shape as `KERGHAN_INTEGRATIONS_MAX_PER_USER` (`409 INTEGRATIONS_LIMIT_REACHED`). Read once with `getNumberConfig`; a non-positive or non-integer value falls back to the default.
- **Checked inside the creating transaction, under the lock that serializes creations:** projects under the user row lock already taken by `lockExistingUser` (both creation routes; the shortcut's "existing project, `200`" path is not a creation and is never refused); issues under the project row lock (create and import). Simultaneous creations therefore cannot overshoot.
- **Import checks the issue cap before the GitHub call** (a cheap pre-check outside the transaction) and again under the lock, so a full project costs no GitHub request.
- Tombstones (deleted projects) do not count. Lowering a cap below a user's current count keeps existing rows and refuses new ones.
- The caps also bound storage (5000 issues × 65536-character bodies, doubled by the base snapshot for linked issues) and the size of a project refresh (T3).

#### Request rate limits

| Limit | Env vars (defaults) | Refusal |
|---|---|---|
| Link creation (import and attach share one window) | `KERGHAN_ISSUES_LINK_MAX_PER_WINDOW` (30), `KERGHAN_ISSUES_LINK_WINDOW_MS` (60000) | `429 ISSUE_LINK_RATE_LIMITED` |
| Issue edits | `KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW` (120), `KERGHAN_ISSUES_EDIT_WINDOW_MS` (60000) | `429 ISSUE_EDIT_RATE_LIMITED` |

- In-memory, per-process fixed windows per user through the shared `Clock`, like `RepositoryAddRateLimiter`: no table, reset on restart, counted per backend instance, expired windows swept.
- **Checked after DTO validation and before the access check**, as Repositories Add does, so every attempt counts and the limit also bounds probing. Both `429`s carry `Retry-After` and `error.retryAfterSeconds`.
- Link creation is limited because each attempt makes one GitHub request with the owner's credential. Edits are limited because each one on a linked issue writes the marker and enqueues a job.
- Refresh (T2, T3) and retry sync (T4) stay unlimited, as decided in [api.md](../specs/issues/api.md): the 60-second fresh skip, the per-link dedupe below and the per-integration pause bound their GitHub calls.

#### Queued jobs are deduplicated per link

- `sync.md`'s optional in-memory dedupe becomes **mandatory**: while a reconcile for a link is queued and not yet started, enqueuing the same link again is a no-op. The link leaves the queued set when its job starts, so an edit that lands during a running job still enqueues the next one (T6 is unaffected).
- Every trigger goes through it (T1 to T6 and the rate-limit timer). The in-memory queue therefore holds at most one waiting job per link, whatever the edit, refresh or boot traffic.
- Per process, lost on restart (boot re-enqueues every marker once). Correctness still never depends on it (E13): duplicates across instances remain harmless.

#### Spec edits in the same PR

- `api.md`: the four new codes join the error catalogue (`409 PROJECTS_LIMIT_REACHED`, `409 ISSUES_LIMIT_REACHED`, `429 ISSUE_LINK_RATE_LIMITED`, `429 ISSUE_EDIT_RATE_LIMITED`) and the order of checks of creation, import, attach and edit; its "quotas and request rate limits" open question is closed.
- `sync.md`: T1's "no dedupe" and E13's optional dedupe become the mandatory per-link dedupe; the five env vars join its Configuration table (the code adds them to `environment-variables.md`).
- `model.md` and `security.md`: close the quotas half of "Encryption at rest … and per-user quotas".
- `edge-cases.md`: E13 notes the mandatory dedupe.

#### Required tests

- The 101st live project and the 5001st issue of a project are refused with `409`; tombstones do not count; the shortcut's existing-project `200` is never refused; simultaneous creations at the cap never overshoot `(db)`; a full project's import makes no GitHub call.
- The 31st link creation and the 121st edit in a window answer `429` with `Retry-After` and `retryAfterSeconds`; the window follows the `FakeClock`; the env overrides apply; a rate-limited request makes no lookup and no GitHub call.
- Enqueuing a queued link is a no-op; an edit during a running job enqueues once more; a burst of edits leaves one waiting job.

### Logs and job params (decided)

#### What may be logged

| Source | Fields allowed | Never |
|---|---|---|
| Access log (existing middleware, unchanged) | `method`, `path` without query, `statusCode`, `requestId` | Bodies. Paths of Issues routes carry only uuids and fixed segments. |
| Issues jobs (`issues.reconcile`) | `jobId`, `linkId`, outcome kind, error class | Titles, bodies, owner/name, URLs, ETags, credentials |
| Issues services (warn/error) | Internal ids (`userId`, `projectId`, `issueId`, `linkId`, `integrationId`), outcome or refusal kind, error class and code | The same as above, plus any exception message |
| Integrations (existing) | Integration id, operation (`getIssue`, `probeIssues`, `updateIssue`), HTTP status, result kind | Request or response bodies, headers, URLs, tokens |
| `user.deleted` listener failure (existing) | `userId`, error class | |

- Job params are `{ linkId }` only (unchanged).
- Internal ids are allowed in logs (they never reach responses). Repository `owner`/`name` are not logged, because for a private repository they are private metadata; `linkId` or `projectId` identifies the row.
- Refusals (`4xx`), cap hits and rate-limit hits are not logged beyond the access line, whose status code already records them. This keeps a flood of refused requests from flooding the logs.

#### Exception messages never reach the logs

- **Duplicate keys are mapped, never re-thrown.** Every unique index of the module (project name, project repository, link per user and GitHub issue, link per issue, marker per link, the two uuid indexes) has its `ER_DUP_ENTRY` caught at the write and mapped to its `409` (or the shortcut's re-read), so it never reaches the unhandled-exception path. MySQL's message for that error contains the duplicated value, which can be a project name.
- **Issues services log `error.constructor.name` and the driver `code`, never `error.message`**, for any database or unexpected error they log themselves. An error that escapes to the global filter is logged there as today; the duplicate-key mapping is what keeps content out of that path.

#### Spec edits in the same PR

- `security.md`: the table above replaces the "Logs and job params carry only safe fields" bullet; the duplicate-key rule is added.
- `sync.md` Job "Logs": points to the table (the job row is unchanged).

#### Required tests

- The canary sweep of [testing.md](../specs/issues/testing.md#security-verification) is extended with a **content canary**: a project name, description, issue title and body, and a repository owner/name carrying canary strings are run through every route and through the reconcile job, including refusals and failures, and no log line contains any of them.
- `(db)`: each unique index's duplicate answers its mapped `409` (or the shortcut's `200`) and logs nothing containing the duplicated value.
- A `4xx` refusal produces only the access line.

### Review checklist (decided)

`security.md` gains a **Review checklist** section: the feature-specific checks the `security` and `data-access` agents apply when the implementation spawned by #492 is reviewed. Their generic definitions are stale (they predate credentials, sessions and TypeORM); refreshing them is #505, and until then the implementation's review prompt points both agents at this section.

#### `security` agent

1. Every Issues route: `JwtGuard` (no `@Public()`/`@AdminOnly()`), `OriginGuard`, `@CachePolicy(CacheClass.UserScoped)`, `POST` only, `X-Skip-Cache` on success and handler errors.
2. No non-`GET` GitHub call outside `IntegrationsGithubIssueWriter`, and only the issues sync service injects it; the `PATCH` body is the `title`/`body`/`state` allowlist; the path comes from stored rows.
3. No redirect followed automatically; a `301` `Location` off `https://api.github.com` sends no credential.
4. Installation tokens are minted per operation with the least permission (`issues: read` for reads, `issues: write` only for `updateIssue`), cached by installation and permission set, never persisted.
5. No credential, title, body, owner/name, URL, ETag or exception message in logs, job params, errors or `error.meta`; duplicate keys are mapped, never re-thrown.
6. Bodies render only through the shared component under the restricted-Markdown rules; no `dangerouslySetInnerHTML`, no raw-HTML plugin, no image loaded; titles and descriptions are text.
7. Input: DTO rules of `api.md` (strict types, code-point lengths), `ParseUUIDPipe` on path ids, `LIKE` metacharacters escaped in searches, values only as bound parameters.
8. Caps checked under the creation lock; both rate limiters before the access check; the per-link job dedupe in place.

#### `data-access` agent

1. Every project and issue read or write goes through the single access check (owner only); no scattered `user_id` filters; issues are looked up inside the path's project.
2. Another user's project, a deleted project and an issue of another project answer the same `404`; the not-found order (project, then issue) reveals nothing about a foreign project.
3. No response contains an internal id (project, issue, repository, link, marker, integration), a `user_id`, an integration field or credential material; `error.meta` carries only uuids, counts, field names, timestamps or reasons.
4. The repo ref resolves only among the caller's own repository rows; a rejected ref reveals no more than Repositories' Add.
5. GitHub work uses the project owner's integrations whatever the actor; the link's `user_id` is used for uniqueness only, never for authorization.
6. Project deletion removes the issues, links and markers; a tombstone is unreachable; `user.deleted` removes everything of the user.
7. Admins have no access to anyone's projects or issues.

#### Spec edits in the same PR

- `security.md`: the Review checklist section above, and a reference to #505.
- `testing.md`: its security-verification section references the checklist; each checklist item maps to a Required test of `security.md` or `api.md`.

## Benefits

- The implementation spawned by #492 has a fixed security contract: who may write to GitHub, through which single fenced operation, and what never leaves the backend or reaches the logs.
- Untrusted GitHub and user content is rendered safely, with one shared component and tests per rule.
- Private issue content leaves the database as soon as its project is deleted, and caps and rate limits bound storage, GitHub calls and the job queue.
- Reviewers get a feature-specific checklist instead of stale generic agent definitions.
